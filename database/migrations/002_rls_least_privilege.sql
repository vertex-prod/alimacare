-- ============================================================================
-- AlimaCare migration 002: least-privilege access (Row Level Security)
--
-- Run AFTER schema.sql and 001_ai_assessment.sql. Idempotent.
--
-- Goal: the web server no longer needs a database key that can read
-- everything. Instead:
--   * Anonymous patients can only call two narrow functions:
--       register_patient(jsonb)   - creates ONE new PENDING row
--       get_ticket_status(text)   - reads ONE ticket's public fields
--   * Staff (ADMIN / RECEPTION / DOCTOR) query with their OWN login. RLS
--     policies decide what each role may read or change.
--   * Only the AI assessment runner still uses the service-role key, from a
--     single isolated server module.
--
-- NOT tested against a live database by the author. Test on a dev project.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Role helper functions (SECURITY DEFINER so they can read staff_profiles
--    without recursing into its own RLS policies)
-- ----------------------------------------------------------------------------
create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sp.role
  from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.active
$$;

create or replace function public.my_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sp.doctor_id
  from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.active
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.staff_role() is not null
$$;

create or replace function public.is_desk_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.staff_role() in ('ADMIN', 'RECEPTION'), false)
$$;

-- Reception/admin see every patient; a doctor sees only patients assigned to
-- them (assigned_doctor stores the doctor's display name).
create or replace function public.can_view_patient(p_patient_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_desk_staff()
    or (
      public.staff_role() = 'DOCTOR'
      and exists (
        select 1
        from public.patients p
        join public.doctors d on lower(d.full_name) = lower(p.assigned_doctor)
        where p.id = p_patient_uuid
          and d.id = public.my_doctor_id()
      )
    )
$$;

create or replace function public.can_view_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ai_assessments a
    where a.id = p_assessment_id
      and public.can_view_patient(a.patient_uuid)
  )
$$;

revoke all on function public.staff_role() from public, anon;
revoke all on function public.my_doctor_id() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_desk_staff() from public, anon;
revoke all on function public.can_view_patient(uuid) from public, anon;
revoke all on function public.can_view_assessment(uuid) from public, anon;

grant execute on function public.staff_role() to authenticated, service_role;
grant execute on function public.my_doctor_id() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_desk_staff() to authenticated, service_role;
grant execute on function public.can_view_patient(uuid) to authenticated, service_role;
grant execute on function public.can_view_assessment(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Workload counts: SECURITY DEFINER so a doctor's own view still counts
--    every doctor's patients (aggregate numbers only), but only for staff.
-- ----------------------------------------------------------------------------
create or replace function public.doctor_workload()
returns table (
  doctor_id uuid,
  active_consultations integer,
  queued_patients integer
)
language sql
stable
security definer
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
  where public.is_staff()
  group by d.id;
$$;

revoke all on function public.doctor_workload() from public, anon;
grant execute on function public.doctor_workload() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Table privileges (column-level where it matters) and RLS policies
-- ----------------------------------------------------------------------------
revoke all on table
  public.staff_profiles,
  public.doctors,
  public.doctor_availability,
  public.doctor_schedules,
  public.ai_assessments,
  public.assessment_validations,
  public.assessment_audit_log
from anon, authenticated;

revoke all on table public.patients from anon, authenticated;

grant select on
  public.staff_profiles,
  public.doctors,
  public.doctor_availability,
  public.doctor_schedules,
  public.ai_assessments,
  public.assessment_validations,
  public.assessment_audit_log,
  public.patients
to authenticated;

grant insert, update on public.doctor_availability to authenticated;
grant insert on public.assessment_audit_log to authenticated;

-- Staff can change only these columns; everything else (identity, consent,
-- signature, contact details...) is read-only through the API.
grant update (
  status, assigned_doctor, assigned_room, queue_number, estimated_wait_minutes,
  patients_ahead, completed_time, called_time, consultation_start_time,
  department, triage_level, clinical_department, ai_assessment_status
) on public.patients to authenticated;

grant update (pending_assignment, needs_human_review, escalated)
  on public.ai_assessments to authenticated;

grant update (
  validation_status, final_level, final_department, final_doctor_id,
  validated_by, validated_by_name, validated_at,
  alert_acknowledged_by, alert_acknowledged_at
) on public.assessment_validations to authenticated;

-- staff_profiles ------------------------------------------------------------
drop policy if exists staff_profiles_select_own on public.staff_profiles;
create policy staff_profiles_select_own on public.staff_profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists staff_profiles_select_admin on public.staff_profiles;
create policy staff_profiles_select_admin on public.staff_profiles
  for select to authenticated
  using (public.staff_role() = 'ADMIN');

-- doctors / schedules -------------------------------------------------------
drop policy if exists doctors_select_staff on public.doctors;
create policy doctors_select_staff on public.doctors
  for select to authenticated
  using (public.is_staff());

drop policy if exists doctor_schedules_select_staff on public.doctor_schedules;
create policy doctor_schedules_select_staff on public.doctor_schedules
  for select to authenticated
  using (public.is_staff());

-- doctor_availability: desk staff set anyone's status, a doctor only their own
drop policy if exists doctor_availability_select_staff on public.doctor_availability;
create policy doctor_availability_select_staff on public.doctor_availability
  for select to authenticated
  using (public.is_staff());

drop policy if exists doctor_availability_insert on public.doctor_availability;
create policy doctor_availability_insert on public.doctor_availability
  for insert to authenticated
  with check (
    public.is_desk_staff()
    or (public.staff_role() = 'DOCTOR' and doctor_id = public.my_doctor_id())
  );

drop policy if exists doctor_availability_update on public.doctor_availability;
create policy doctor_availability_update on public.doctor_availability
  for update to authenticated
  using (
    public.is_desk_staff()
    or (public.staff_role() = 'DOCTOR' and doctor_id = public.my_doctor_id())
  )
  with check (
    public.is_desk_staff()
    or (public.staff_role() = 'DOCTOR' and doctor_id = public.my_doctor_id())
  );

-- patients ------------------------------------------------------------------
drop policy if exists patients_select_staff on public.patients;
create policy patients_select_staff on public.patients
  for select to authenticated
  using (public.can_view_patient(id));

drop policy if exists patients_update_staff on public.patients;
create policy patients_update_staff on public.patients
  for update to authenticated
  using (public.can_view_patient(id))
  with check (public.is_staff());

-- ai_assessments / validations / audit --------------------------------------
drop policy if exists ai_assessments_select_staff on public.ai_assessments;
create policy ai_assessments_select_staff on public.ai_assessments
  for select to authenticated
  using (public.can_view_patient(patient_uuid));

drop policy if exists ai_assessments_update_staff on public.ai_assessments;
create policy ai_assessments_update_staff on public.ai_assessments
  for update to authenticated
  using (public.can_view_patient(patient_uuid))
  with check (public.is_staff());

drop policy if exists assessment_validations_select_staff on public.assessment_validations;
create policy assessment_validations_select_staff on public.assessment_validations
  for select to authenticated
  using (public.can_view_assessment(assessment_id));

drop policy if exists assessment_validations_update_staff on public.assessment_validations;
create policy assessment_validations_update_staff on public.assessment_validations
  for update to authenticated
  using (public.can_view_assessment(assessment_id))
  with check (public.is_staff());

drop policy if exists assessment_audit_select_staff on public.assessment_audit_log;
create policy assessment_audit_select_staff on public.assessment_audit_log
  for select to authenticated
  using (public.can_view_assessment(assessment_id));

-- A staff member can only write audit rows in their own name.
drop policy if exists assessment_audit_insert_staff on public.assessment_audit_log;
create policy assessment_audit_insert_staff on public.assessment_audit_log
  for insert to authenticated
  with check (
    staff_user_id = auth.uid()
    and public.can_view_assessment(assessment_id)
  );

-- ----------------------------------------------------------------------------
-- 4. Public (anonymous) functions
-- ----------------------------------------------------------------------------
-- register_patient: whitelists the columns a patient may supply and FORCES the
-- status to PENDING_RECEPTION, so a caller cannot self-approve, choose a queue
-- number, assign a doctor or set a triage level, even though the anon key is
-- public. Database constraints and triggers still validate every value.
create or replace function public.register_patient(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.patients;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'Invalid registration.';
  end if;

  if not coalesce((p ->> 'consent_given')::boolean, false) then
    raise exception 'Data privacy consent is required.';
  end if;

  insert into public.patients (
    respondent_role, visit_purpose, full_name, identity_unknown, dob, age, sex,
    civil_status, address, contact_number, chief_complaint, allergies,
    symptom_duration, symptom_severity, medical_history, existing_conditions,
    current_medications, has_request_slip, priority_lane, payment_type,
    hmo_provider, hmo_no, philhealth_pin, employer_name, room_preference,
    emergency_contact_name, emergency_contact_relationship,
    emergency_contact_number, guardian_full_name, guardian_relationship,
    guardian_contact_number, guardian_id_type, signature_data, consent_given,
    status
  )
  values (
    (p ->> 'respondent_role')::public.respondent_role,
    (p ->> 'visit_purpose')::public.visit_purpose,
    p ->> 'full_name',
    coalesce((p ->> 'identity_unknown')::boolean, false),
    nullif(p ->> 'dob', '')::date,
    (p ->> 'age')::smallint,
    (p ->> 'sex')::public.patient_sex,
    nullif(p ->> 'civil_status', '')::public.civil_status,
    p ->> 'address',
    p ->> 'contact_number',
    p ->> 'chief_complaint',
    p ->> 'allergies',
    p ->> 'symptom_duration',
    nullif(p ->> 'symptom_severity', '')::smallint,
    p ->> 'medical_history',
    p ->> 'existing_conditions',
    p ->> 'current_medications',
    nullif(p ->> 'has_request_slip', '')::boolean,
    coalesce(nullif(p ->> 'priority_lane', ''), 'regular')::public.priority_lane,
    coalesce(nullif(p ->> 'payment_type', ''), 'cash')::public.payment_type,
    p ->> 'hmo_provider',
    p ->> 'hmo_no',
    p ->> 'philhealth_pin',
    p ->> 'employer_name',
    nullif(p ->> 'room_preference', '')::public.room_preference,
    p ->> 'emergency_contact_name',
    p ->> 'emergency_contact_relationship',
    p ->> 'emergency_contact_number',
    p ->> 'guardian_full_name',
    nullif(p ->> 'guardian_relationship', '')::public.guardian_relationship,
    p ->> 'guardian_contact_number',
    p ->> 'guardian_id_type',
    p ->> 'signature_data',
    true,
    'PENDING_RECEPTION'
  )
  returning * into v_row;

  return to_jsonb(v_row) - 'signature_data';
end;
$$;

-- get_ticket_status: the public status page. Returns only display fields for
-- ONE ticket, addressed by its reference (AC-...) or internal id.
create or replace function public.get_ticket_status(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v public.patients;
  v_ahead integer;
begin
  if p_ref is null or length(p_ref) > 64 then
    return null;
  end if;

  if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v from public.patients where id = p_ref::uuid;
  else
    select * into v from public.patients where patient_id = p_ref;
  end if;

  if not found then
    return null;
  end if;

  if v.status in ('COMPLETED', 'CANCELLED', 'NO_SHOW', 'ARCHIVED') then
    v_ahead := null;
  elsif v.status in ('CALLED', 'ONGOING') then
    v_ahead := 0;
  elsif v.queue_date is not null and v.department is not null then
    select count(*)::integer into v_ahead
    from public.patients o
    where o.queue_date = v.queue_date
      and o.department = v.department
      and o.registration_datetime < v.registration_datetime
      and o.status in ('PENDING_RECEPTION', 'APPROVED', 'WAITING');
  end if;

  return jsonb_build_object(
    'patient_id', v.patient_id,
    'full_name', v.full_name,
    'status', v.status,
    'visit_purpose', v.visit_purpose,
    'department', v.department,
    'priority_lane', v.priority_lane,
    'queue_number', v.queue_number,
    'assigned_room', v.assigned_room,
    'estimated_wait_minutes', v.estimated_wait_minutes,
    'assigned_doctor', v.assigned_doctor,
    'completed_time', v.completed_time,
    'patients_ahead', v_ahead
  );
end;
$$;

revoke all on function public.register_patient(jsonb) from public;
revoke all on function public.get_ticket_status(text) from public;
grant execute on function public.register_patient(jsonb) to anon, authenticated, service_role;
grant execute on function public.get_ticket_status(text) to anon, authenticated, service_role;

commit;
