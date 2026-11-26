-- ============================================================================
-- AlimaCare — Supabase / PostgreSQL schema
-- ============================================================================
-- Adaptive QR intake and queue schema for a hospital-agnostic deployment.
--
-- This script is DESTRUCTIVE: it drops the old tables, types, functions, and
-- sequence before creating the new schema. Run it only when you are ready to
-- reset the Supabase database.
--
-- How to apply:
--   1. Open your Supabase project.
--   2. Go to SQL Editor.
--   3. Paste this whole file and click Run.
--
-- The intake form writes:
--   respondent role, visit purpose, patient identity, DOB/age, sex, civil
--   status, address, mobile number, chief complaint, allergies, request slip,
--   priority lane, payment type, HMO/PhilHealth details, emergency contact,
--   guardian/informant details, signature, and privacy consent.
--
-- The database generates:
--   patient reference (AC-YYYYMMDD-0001), department (OPD/LAB/ER), and the
--   daily ticket number (OPD-001, LAB-001, ER-001).
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Remove the previous database objects
-- ----------------------------------------------------------------------------
drop table if exists public.queue_events cascade;
drop table if exists public.patients cascade;
drop table if exists public.queue_counters cascade;
drop table if exists public.doctors cascade;
drop table if exists public.rooms cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.daily_exports cascade;
drop table if exists public.users cascade;

drop function if exists public.log_patient_status_change() cascade;
drop function if exists public.patients_before_write() cascade;
drop function if exists public.next_queue_number(text) cascade;
drop function if exists public.generate_patient_id() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.appointment_status cascade;
drop type if exists public.patient_sex cascade;
drop type if exists public.patient_classification cascade;
drop type if exists public.respondent_role cascade;
drop type if exists public.visit_purpose cascade;
drop type if exists public.priority_lane cascade;
drop type if exists public.payment_type cascade;
drop type if exists public.civil_status cascade;
drop type if exists public.guardian_relationship cascade;
drop type if exists public.room_preference cascade;

drop sequence if exists public.patient_id_seq cascade;

-- ----------------------------------------------------------------------------
-- 2. Enumerated values used by the adaptive intake form
-- ----------------------------------------------------------------------------
create type public.patient_sex as enum ('Male', 'Female', 'Other');

create type public.respondent_role as enum ('self', 'guardian');

create type public.visit_purpose as enum (
  'consultation',
  'diagnostic',
  'emergency'
);

create type public.priority_lane as enum (
  'regular',
  'senior_citizen',
  'pwd',
  'pregnant'
);

create type public.payment_type as enum ('cash', 'hmo', 'philhealth');

create type public.civil_status as enum (
  'single',
  'married',
  'widowed',
  'separated',
  'other'
);

create type public.guardian_relationship as enum (
  'parent',
  'spouse',
  'child',
  'relative',
  'other'
);

create type public.room_preference as enum (
  'ward',
  'semi_private',
  'private',
  'suite'
);

create type public.appointment_status as enum (
  'PENDING_RECEPTION',
  'APPROVED',
  'WAITING',
  'CALLED',
  'ONGOING',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'ARCHIVED'
);

-- ----------------------------------------------------------------------------
-- 3. Helpers: patient reference and daily ticket numbers
-- ----------------------------------------------------------------------------
create sequence public.patient_id_seq;

create function public.generate_patient_id()
returns text
language sql
volatile
as $$
  select 'AC-' ||
         to_char(timezone('Asia/Manila', now()), 'YYYYMMDD') || '-' ||
         lpad(nextval('public.patient_id_seq')::text, 4, '0');
$$;

comment on function public.generate_patient_id()
  is 'Creates a readable patient reference such as AC-20261126-0001.';

create table public.queue_counters (
  queue_date date not null,
  prefix text not null check (prefix ~ '^[A-Z]+$'),
  last_number integer not null default 0 check (last_number >= 0),
  primary key (queue_date, prefix)
);

create function public.next_queue_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  insert into public.queue_counters as qc (queue_date, prefix, last_number)
  values ((timezone('Asia/Manila', now()))::date, p_prefix, 1)
  on conflict (queue_date, prefix) do update
    set last_number = qc.last_number + 1
  returning last_number into v_next;

  return p_prefix || '-' || lpad(v_next::text, 3, '0');
end;
$$;

comment on function public.next_queue_number(text)
  is 'Resets daily and returns a ticket number such as OPD-001, LAB-001, or ER-001.';

-- ----------------------------------------------------------------------------
-- 4. Intake records
-- ----------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),

  -- Public, readable reference shown to the patient.
  patient_id text not null unique default public.generate_patient_id(),

  -- Adaptive routing.
  respondent_role public.respondent_role not null,
  visit_purpose public.visit_purpose not null,

  -- Patient identity.
  full_name text not null,
  identity_unknown boolean not null default false,
  dob date,
  age smallint not null,
  sex public.patient_sex not null,
  civil_status public.civil_status,
  address text,
  contact_number text,

  -- Visit information.
  chief_complaint text not null,
  allergies text,
  has_request_slip boolean,

  -- Priority and billing.
  priority_lane public.priority_lane not null default 'regular',
  payment_type public.payment_type not null default 'cash',
  hmo_provider text,
  hmo_no text,
  philhealth_pin text,
  employer_name text,
  room_preference public.room_preference,

  -- Emergency contact.
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_number text,

  -- Guardian (when the respondent is a guardian) or informant/guarantor
  -- (when a companion fills out an emergency intake).
  guardian_full_name text,
  guardian_relationship public.guardian_relationship,
  guardian_contact_number text,
  guardian_id_type text,

  -- Consent.
  signature_data text,
  consent_given boolean not null default false,

  -- Queue workflow.
  department text not null,
  status public.appointment_status not null default 'PENDING_RECEPTION',
  queue_number text,
  queue_date date,
  assigned_doctor text,
  assigned_room text,
  patients_ahead integer,
  estimated_wait_minutes integer,
  called_time timestamptz,
  consultation_start_time timestamptz,
  completed_time timestamptz,

  -- Metadata.
  registration_datetime timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patients_full_name_length
    check (char_length(btrim(full_name)) between 1 and 120),
  constraint patients_age_range
    check (age between 0 and 150),
  constraint patients_contact_format
    check (
      contact_number is null
      or contact_number ~ '^[0-9+() -]{7,20}$'
    ),
  constraint patients_emergency_contact_format
    check (
      emergency_contact_number is null
      or emergency_contact_number ~ '^[0-9+() -]{7,20}$'
    ),
  constraint patients_guardian_contact_format
    check (
      guardian_contact_number is null
      or guardian_contact_number ~ '^[0-9+() -]{7,20}$'
    ),
  constraint patients_chief_complaint_length
    check (char_length(btrim(chief_complaint)) between 1 and 500),
  constraint patients_address_length
    check (address is null or char_length(address) <= 240),
  constraint patients_allergies_length
    check (allergies is null or char_length(allergies) <= 500),
  constraint patients_guardian_name_length
    check (
      guardian_full_name is null
      or char_length(btrim(guardian_full_name)) between 1 and 120
    ),
  constraint patients_employer_length
    check (employer_name is null or char_length(employer_name) <= 120),
  constraint patients_hmo_provider_length
    check (hmo_provider is null or char_length(hmo_provider) <= 120),
  constraint patients_hmo_no_length
    check (hmo_no is null or char_length(hmo_no) <= 40),
  constraint patients_philhealth_pin_length
    check (philhealth_pin is null or char_length(philhealth_pin) <= 40),
  constraint patients_department_format
    check (department ~ '^[A-Z]{2,8}$'),
  constraint patients_queue_number_format
    check (queue_number is null or queue_number ~ '^[A-Z]+-[0-9]{3,4}$'),
  constraint patients_queue_date_required
    check ((queue_number is null) = (queue_date is null)),
  constraint patients_estimated_wait_non_negative
    check (estimated_wait_minutes is null or estimated_wait_minutes >= 0),
  constraint patients_ahead_non_negative
    check (patients_ahead is null or patients_ahead >= 0),
  constraint patients_signature_size
    check (signature_data is null or char_length(signature_data) <= 800000)
);

comment on table public.patients
  is 'Adaptive intake answers, patient identity, and live queue state.';

comment on column public.patients.patient_id
  is 'Readable public reference generated by the database.';
comment on column public.patients.identity_unknown
  is 'True for an unconscious or unidentified emergency patient.';
comment on column public.patients.department
  is 'Ticket prefix / department code: OPD, LAB, or ER.';
comment on column public.patients.guardian_full_name
  is 'Guardian for a guardian-led intake, or informant/guarantor for an emergency.';
comment on column public.patients.queue_number
  is 'Daily ticket number such as OPD-001, LAB-001, or ER-001.';
comment on column public.patients.signature_data
  is 'PNG data URL captured from the signature pad.';

-- ----------------------------------------------------------------------------
-- 5. Status history
-- ----------------------------------------------------------------------------
create table public.queue_events (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  queue_number text,
  status public.appointment_status not null,
  performed_by text,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.queue_events
  is 'Append-only history of registration and status changes.';

-- ----------------------------------------------------------------------------
-- 6. Triggers
-- ----------------------------------------------------------------------------
create function public.patients_before_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Normalise form input before constraints are evaluated.
  new.full_name := btrim(new.full_name);
  new.contact_number := nullif(btrim(new.contact_number), '');
  new.address := nullif(btrim(new.address), '');
  new.chief_complaint := btrim(new.chief_complaint);
  new.allergies := nullif(btrim(new.allergies), '');
  new.hmo_provider := nullif(btrim(new.hmo_provider), '');
  new.hmo_no := nullif(btrim(new.hmo_no), '');
  new.philhealth_pin := nullif(btrim(new.philhealth_pin), '');
  new.employer_name := nullif(btrim(new.employer_name), '');
  new.emergency_contact_name :=
    nullif(btrim(new.emergency_contact_name), '');
  new.emergency_contact_relationship :=
    nullif(btrim(new.emergency_contact_relationship), '');
  new.emergency_contact_number :=
    nullif(btrim(new.emergency_contact_number), '');
  new.guardian_full_name := nullif(btrim(new.guardian_full_name), '');
  new.guardian_contact_number :=
    nullif(btrim(new.guardian_contact_number), '');
  new.guardian_id_type := nullif(btrim(new.guardian_id_type), '');
  new.assigned_doctor := nullif(btrim(new.assigned_doctor), '');
  new.assigned_room := nullif(btrim(new.assigned_room), '');
  new.updated_at := now();

  if new.dob is not null then
    if new.dob > current_date then
      raise exception 'Date of birth cannot be in the future.';
    end if;

    -- Keep the stored age consistent with the date of birth.
    new.age := extract(year from age(new.dob))::smallint;
  end if;

  -- Resolve the department from the visit purpose unless staff explicitly
  -- routed the ticket elsewhere.
  if new.department is null or btrim(new.department) = '' then
    new.department := case new.visit_purpose
      when 'consultation' then 'OPD'
      when 'diagnostic' then 'LAB'
      when 'emergency' then 'ER'
    end;
  end if;

  new.department := upper(btrim(new.department));

  if tg_op = 'INSERT' then
    if new.registration_datetime is null then
      new.registration_datetime := now();
    end if;

    -- Every registration gets a live ticket immediately.
    if new.queue_number is null then
      new.queue_date := (timezone('Asia/Manila', now()))::date;
      new.queue_number := public.next_queue_number(new.department);
    end if;
  elsif tg_op = 'UPDATE' then
    -- Supports staff creating an active ticket for a record that has none.
    if new.queue_number is null
       and new.status in ('APPROVED', 'WAITING', 'CALLED', 'ONGOING') then
      new.queue_date := (timezone('Asia/Manila', now()))::date;
      new.queue_number := public.next_queue_number(new.department);
    end if;

    if new.status = 'CALLED'
       and old.status is distinct from 'CALLED'
       and new.called_time is null then
      new.called_time := now();
    end if;

    if new.status = 'ONGOING'
       and old.status is distinct from 'ONGOING'
       and new.consultation_start_time is null then
      new.consultation_start_time := now();
    end if;

    if new.status = 'COMPLETED'
       and old.status is distinct from 'COMPLETED'
       and new.completed_time is null then
      new.completed_time := now();
    end if;
  end if;

  -- Keep queue_date and queue_number consistent even when a staff endpoint
  -- assigns or clears a ticket number directly.
  if new.queue_number is not null and new.queue_date is null then
    new.queue_date := (timezone('Asia/Manila', now()))::date;
  elsif new.queue_number is null then
    new.queue_date := null;
  end if;

  return new;
end;
$$;

create function public.log_patient_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_performed_by text;
begin
  v_performed_by := nullif(current_setting('request.jwt.claim.sub', true), '');

  if tg_op = 'INSERT' then
    insert into public.queue_events
      (patient_id, queue_number, status, performed_by, notes)
    values
      (new.id, new.queue_number, new.status, v_performed_by, 'Patient registered');
  elsif new.status is distinct from old.status then
    insert into public.queue_events
      (patient_id, queue_number, status, performed_by, notes)
    values
      (new.id, new.queue_number, new.status, v_performed_by, 'Status updated');
  end if;

  return new;
end;
$$;

create trigger trg_patients_before_write
before insert or update on public.patients
for each row execute function public.patients_before_write();

create trigger trg_patients_log_status
after insert or update of status on public.patients
for each row execute function public.log_patient_status_change();

-- ----------------------------------------------------------------------------
-- 7. Indexes
-- ----------------------------------------------------------------------------
create index patients_status_idx
  on public.patients (status);
create index patients_registration_idx
  on public.patients (registration_datetime);
create index patients_status_registration_idx
  on public.patients (status, registration_datetime);
create index patients_doctor_status_idx
  on public.patients (assigned_doctor, status);
create index patients_department_status_idx
  on public.patients (department, status);
create index patients_department_queue_idx
  on public.patients (queue_date, department, queue_number);

-- Ticket numbers reset every day, so uniqueness is per (day, number).
create unique index patients_queue_unique_idx
  on public.patients (queue_date, queue_number)
  where queue_number is not null;

create index queue_events_patient_idx
  on public.queue_events (patient_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 8. Security
-- ----------------------------------------------------------------------------
-- The Next.js app talks to Supabase with the service-role key from server-side
-- API routes only. RLS is enabled with no public policies, and direct access
-- from anon/authenticated is revoked. The service role bypasses RLS.
alter table public.patients enable row level security;
alter table public.queue_events enable row level security;
alter table public.queue_counters enable row level security;

revoke all on table public.patients from anon, authenticated;
revoke all on table public.queue_events from anon, authenticated;
revoke all on table public.queue_counters from anon, authenticated;
revoke all on sequence public.patient_id_seq from anon, authenticated;

revoke all on function public.generate_patient_id()
  from public, anon, authenticated;
revoke all on function public.next_queue_number(text)
  from public, anon, authenticated;
revoke all on function public.patients_before_write()
  from public, anon, authenticated;
revoke all on function public.log_patient_status_change()
  from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on table public.patients to service_role;
grant all on table public.queue_events to service_role;
grant all on table public.queue_counters to service_role;
grant usage, select on sequence public.patient_id_seq to service_role;

grant execute on function public.generate_patient_id() to service_role;
grant execute on function public.next_queue_number(text) to service_role;
grant execute on function public.patients_before_write() to service_role;
grant execute on function public.log_patient_status_change() to service_role;

commit;

-- ============================================================================
-- Optional smoke test (safe to skip)
-- ============================================================================
-- insert into public.patients
--   (respondent_role, visit_purpose, full_name, age, sex, chief_complaint,
--    contact_number, consent_given)
-- values
--   ('self', 'consultation', 'Maria Santos', 34, 'Female',
--    'Fever and cough for three days', '+63 912 345 6789', true);
--
-- select patient_id, full_name, department, status, queue_number
-- from public.patients
-- order by created_at desc;
