-- AlimaCare — security and performance hardening
-- Run after 0001_initial.sql.
--
-- The application only talks to Supabase through the service-role key on the
-- server. Enabling RLS with no policies blocks the anon/authenticated roles from
-- reading patient data directly through the public Supabase API, while the
-- service role continues to work (it bypasses RLS).

alter table if exists users enable row level security;
alter table if exists patients enable row level security;
alter table if exists doctors enable row level security;
alter table if exists rooms enable row level security;
alter table if exists queue_events enable row level security;
alter table if exists audit_logs enable row level security;
alter table if exists daily_exports enable row level security;


alter table if exists patients add column if not exists queue_date date;

-- Backfill the day for existing queue numbers so they keep their original day.
-- (New approvals set queue_date from the application's local date.)
update patients
set queue_date = registration_datetime::date
where queue_date is null
  and registration_datetime is not null;

-- Older builds generated every queue number as `<prefix>-001`, so existing
-- databases may contain duplicates. Keep the first one and suffix the rest
-- instead of deleting or renumbering patient records.
with ranked as (
  select id,
         row_number() over (
           partition by queue_date, split_part(queue_number, '-', 1)
           order by registration_datetime nulls last, id
         ) as position
  from patients
  where queue_number is not null
    and queue_date is not null
    and queue_number ~ '^[A-Z]-[0-9]+$'
)
update patients p
set queue_number = p.queue_number || '-' || r.position
from ranked r
where p.id = r.id
  and r.position > 1;

-- Queue numbers reset every day, so uniqueness is per (day, number).
-- The partial index makes concurrent approvals retry instead of duplicating.
create unique index if not exists idx_patients_queue_number_unique
  on patients(queue_date, queue_number)
  where queue_number is not null;

-- Common queue queries: active patients for a doctor, and today's registrations.
create index if not exists idx_patients_doctor_status
  on patients(assigned_doctor, status);
create index if not exists idx_patients_registration_datetime
  on patients(registration_datetime);
create index if not exists idx_queue_events_patient
  on queue_events(patient_id);
