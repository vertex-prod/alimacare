-- ============================================================================
-- AlimaCare migration 001: AI-assisted assessment, doctors, staff and audit
--
-- Additive and idempotent. It does NOT drop or rewrite any existing table, so
-- it is safe to run on top of database/schema.sql. Run it in the Supabase SQL
-- editor (preferably on a branch / dev project first).
--
-- All new tables have Row Level Security enabled and NO public policies: every
-- read and write goes through server-only API routes using the service role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extra intake fields on patients
-- ----------------------------------------------------------------------------
alter table public.patients
  add column if not exists symptom_duration text,
  add column if not exists symptom_severity smallint,
  add column if not exists medical_history text,
  add column if not exists existing_conditions text,
  add column if not exists current_medications text,
  -- patients.department is the ticket prefix (OPD/LAB/ER) and must stay
  -- 2-8 capital letters, so the clinical department is stored separately.
  add column if not exists clinical_department text,
  -- Provisional or validated triage level (1 = most urgent). Drives queue order.
  add column if not exists triage_level smallint,
  add column if not exists ai_assessment_status text not null default 'not_started';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patients_symptom_severity_range') then
    alter table public.patients add constraint patients_symptom_severity_range
      check (symptom_severity is null or symptom_severity between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_triage_level_range') then
    alter table public.patients add constraint patients_triage_level_range
      check (triage_level is null or triage_level between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_ai_status_values') then
    alter table public.patients add constraint patients_ai_status_values
      check (ai_assessment_status in
        ('not_started', 'pending', 'completed', 'failed', 'needs_review'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'patients_symptom_text_length') then
    alter table public.patients add constraint patients_symptom_text_length
      check (
        char_length(coalesce(symptom_duration, '')) <= 200
        and char_length(coalesce(medical_history, '')) <= 1000
        and char_length(coalesce(existing_conditions, '')) <= 1000
        and char_length(coalesce(current_medications, '')) <= 1000
      );
  end if;
end $$;

create index if not exists patients_triage_queue_idx
  on public.patients (triage_level, registration_datetime)
  where status in ('PENDING_RECEPTION', 'APPROVED', 'WAITING');

-- ----------------------------------------------------------------------------
-- 2. Staff profiles (roles for Supabase Auth users)
-- ----------------------------------------------------------------------------
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text not null,
  department text not null,
  accepts_patients boolean not null default true,
  emergency_available boolean not null default false,
  active boolean not null default true,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  constraint doctors_name_length check (char_length(btrim(full_name)) between 1 and 120)
);

create unique index if not exists doctors_full_name_idx
  on public.doctors (lower(full_name));

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null,
  doctor_id uuid references public.doctors (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint staff_profiles_role_values check (role in ('ADMIN', 'RECEPTION', 'DOCTOR'))
);

-- ----------------------------------------------------------------------------
-- 3. Doctor availability and duty schedule
-- ----------------------------------------------------------------------------
create table if not exists public.doctor_availability (
  doctor_id uuid primary key references public.doctors (id) on delete cascade,
  status text not null default 'OFF_DUTY',
  status_updated_at timestamptz not null default now(),
  constraint doctor_availability_status_values check (
    status in ('AVAILABLE', 'BUSY', 'ON_BREAK', 'OFF_DUTY', 'UNAVAILABLE')
  )
);

-- weekday follows Postgres extract(dow): 0 = Sunday ... 6 = Saturday.
-- Times are Asia/Manila local time. A doctor with no rows is never on duty.
create table if not exists public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint doctor_schedules_range check (start_time <> end_time)
);

create index if not exists doctor_schedules_doctor_idx
  on public.doctor_schedules (doctor_id, weekday);

-- ----------------------------------------------------------------------------
-- 4. AI assessments, staff validation, audit log
-- ----------------------------------------------------------------------------
create table if not exists public.ai_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_uuid uuid not null references public.patients (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'completed',
  analysis_source text not null default 'rules',
  primary_symptoms text[] not null default '{}',
  secondary_symptoms text[] not null default '{}',
  relevant_history text[] not null default '{}',
  potential_concerns text[] not null default '{}',
  warning_signs text[] not null default '{}',
  recommended_action text,
  confidence text,
  missing_info text[] not null default '{}',
  triage_level smallint not null,
  rule_floor_level smallint,
  classification_reason text not null,
  rule_flags jsonb not null default '[]'::jsonb,
  recommended_department text,
  department_reason text,
  recommended_doctor_id uuid references public.doctors (id) on delete set null,
  doctor_availability_snapshot jsonb,
  pending_assignment boolean not null default false,
  needs_human_review boolean not null default false,
  escalated boolean not null default false,
  model text,
  error_detail text,
  created_at timestamptz not null default now(),
  constraint ai_assessments_status_values check (status in ('completed', 'failed')),
  constraint ai_assessments_level_range check (triage_level between 1 and 5),
  constraint ai_assessments_confidence_values
    check (confidence is null or confidence in ('low', 'medium', 'high')),
  unique (patient_uuid, version)
);

create index if not exists ai_assessments_patient_idx
  on public.ai_assessments (patient_uuid, version desc);
create index if not exists ai_assessments_alert_idx
  on public.ai_assessments (created_at desc)
  where escalated;

create table if not exists public.assessment_validations (
  assessment_id uuid primary key references public.ai_assessments (id) on delete cascade,
  validation_status text not null default 'PENDING',
  final_level smallint,
  final_department text,
  final_doctor_id uuid references public.doctors (id) on delete set null,
  validated_by uuid references auth.users (id) on delete set null,
  validated_by_name text,
  validated_at timestamptz,
  alert_acknowledged_by uuid references auth.users (id) on delete set null,
  alert_acknowledged_at timestamptz,
  constraint assessment_validations_status_values check (
    validation_status in ('PENDING', 'APPROVED', 'OVERRIDDEN', 'FLAGGED')
  ),
  constraint assessment_validations_level_range
    check (final_level is null or final_level between 1 and 5)
);

create table if not exists public.assessment_audit_log (
  id bigint generated always as identity primary key,
  assessment_id uuid not null references public.ai_assessments (id) on delete cascade,
  staff_user_id uuid references auth.users (id) on delete set null,
  staff_name text not null,
  action text not null,
  field text,
  original_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists assessment_audit_log_assessment_idx
  on public.assessment_audit_log (assessment_id, created_at);

-- The audit log is append-only: nobody (not even the service role) can edit
-- or delete history through the API.
create or replace function public.assessment_audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'assessment_audit_log is append-only.';
end;
$$;

drop trigger if exists assessment_audit_log_no_update on public.assessment_audit_log;
create trigger assessment_audit_log_no_update
  before update or delete on public.assessment_audit_log
  for each row execute function public.assessment_audit_log_immutable();

-- ----------------------------------------------------------------------------
-- 5. Live doctor workload
-- ----------------------------------------------------------------------------
-- patients.assigned_doctor stores the doctor's display name, so workload is
-- matched on the name. Active consultations are CALLED/ONGOING; the queue is
-- APPROVED/WAITING patients already assigned to that doctor.
create or replace function public.doctor_workload()
returns table (
  doctor_id uuid,
  active_consultations integer,
  queued_patients integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    d.id,
    count(p.id) filter (where p.status in ('CALLED', 'ONGOING'))::integer,
    count(p.id) filter (where p.status in ('APPROVED', 'WAITING'))::integer
  from public.doctors d
  left join public.patients p
    on lower(p.assigned_doctor) = lower(d.full_name)
   and p.status in ('APPROVED', 'WAITING', 'CALLED', 'ONGOING')
  group by d.id;
$$;

-- ----------------------------------------------------------------------------
-- 6. Row Level Security: server-only access
-- ----------------------------------------------------------------------------
alter table public.doctors enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.doctor_availability enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.ai_assessments enable row level security;
alter table public.assessment_validations enable row level security;
alter table public.assessment_audit_log enable row level security;

revoke all on function public.doctor_workload() from public, anon, authenticated;
grant execute on function public.doctor_workload() to service_role;

-- ----------------------------------------------------------------------------
-- 7. SAMPLE doctors (replace with the hospital's real roster before use)
-- ----------------------------------------------------------------------------
-- These rows are flagged is_sample = true so they are easy to find and delete:
--   delete from public.doctors where is_sample;
insert into public.doctors (full_name, specialty, department, emergency_available, is_sample)
select v.full_name, v.specialty, v.department, v.emergency_available, true
from (values
  ('Dr. Sample Emergency A',  'Emergency Medicine',  'Emergency Department',      true),
  ('Dr. Sample Emergency B',  'Emergency Medicine',  'Emergency Department',      true),
  ('Dr. Sample Internist A',  'Internal Medicine',   'Internal Medicine',         false),
  ('Dr. Sample Internist B',  'Internal Medicine',   'Internal Medicine',         false),
  ('Dr. Sample Cardio A',     'Cardiology',          'Cardiology',                true),
  ('Dr. Sample Derm A',       'Dermatology',         'Dermatology',               false),
  ('Dr. Sample Ortho A',      'Orthopedics',         'Orthopedics',               true),
  ('Dr. Sample Eye A',        'Ophthalmology',       'Ophthalmology',             false),
  ('Dr. Sample ENT A',        'Otolaryngology',      'ENT',                       false),
  ('Dr. Sample Pedia A',      'Pediatrics',          'Pediatrics',                true),
  ('Dr. Sample OBGYN A',      'Obstetrics and Gynecology', 'Obstetrics and Gynecology', true),
  ('Dr. Sample GI A',         'Gastroenterology',    'Gastroenterology',          false),
  ('Dr. Sample Neuro A',      'Neurology',           'Neurology',                 true)
) as v(full_name, specialty, department, emergency_available)
where not exists (
  select 1 from public.doctors d where lower(d.full_name) = lower(v.full_name)
);

insert into public.doctor_availability (doctor_id, status)
select d.id, 'AVAILABLE' from public.doctors d where d.is_sample
on conflict (doctor_id) do nothing;

-- Emergency doctors: round the clock. Everyone else: Mon-Sat 08:00-17:00.
insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time)
select d.id, w.weekday, '00:00', '23:59'
from public.doctors d cross join generate_series(0, 6) as w(weekday)
where d.is_sample and d.department = 'Emergency Department'
  and not exists (select 1 from public.doctor_schedules s where s.doctor_id = d.id);

insert into public.doctor_schedules (doctor_id, weekday, start_time, end_time)
select d.id, w.weekday, '08:00', '17:00'
from public.doctors d cross join generate_series(1, 6) as w(weekday)
where d.is_sample and d.department <> 'Emergency Department'
  and not exists (select 1 from public.doctor_schedules s where s.doctor_id = d.id);
