-- ============================================================================
-- AlimaCare migration 003: explicit, minimal grants for the AI assessment runner
--
-- Some Supabase projects do not give the API roles automatic privileges on new
-- tables, so the service_role key gets "permission denied" even though it
-- bypasses RLS (RLS bypass does not replace table GRANTs).
--
-- Instead of granting ALL, this gives the key ONLY what the AI assessment
-- runner uses, so a leaked key can do much less than a default service role.
-- Idempotent. Run after 001 and 002.
-- ============================================================================

begin;

grant usage on schema public to service_role;

-- Reads the patient's clinical fields and writes back the assessment state.
grant select on public.patients to service_role;
grant update (ai_assessment_status, triage_level, clinical_department)
  on public.patients to service_role;

-- Live doctor availability used for assignment.
grant select on public.doctors to service_role;
grant select on public.doctor_availability to service_role;
grant select on public.doctor_schedules to service_role;

-- Stores assessments and the pending validation row.
grant select, insert, update on public.ai_assessments to service_role;
grant select, insert, update on public.assessment_validations to service_role;

grant execute on function public.doctor_workload() to service_role;

commit;
