-- ============================================================================
-- AlimaCare migration 004: doctor acceptance of an assigned patient
--
-- Additive and idempotent. Run AFTER schema.sql, 001, 002 and 003.
--
-- Reception/admin assign a doctor to an assessment. The assigned doctor then
-- reviews the intake and either accepts the assignment (the patient moves to
-- WAITING) or declines it with a reason (the patient returns to the reception
-- queue with no doctor assigned).
-- ============================================================================

begin;

alter table public.assessment_validations
  add column if not exists doctor_decision text not null default 'PENDING',
  add column if not exists doctor_decision_note text,
  add column if not exists doctor_decision_at timestamptz,
  add column if not exists doctor_decision_by uuid
    references auth.users (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_validations_doctor_decision_values'
  ) then
    alter table public.assessment_validations
      add constraint assessment_validations_doctor_decision_values
      check (doctor_decision in ('PENDING', 'ACCEPTED', 'REJECTED'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assessment_validations_doctor_decision_note_length'
  ) then
    alter table public.assessment_validations
      add constraint assessment_validations_doctor_decision_note_length
      check (
        doctor_decision_note is null
        or char_length(doctor_decision_note) <= 500
      );
  end if;
end $$;

create index if not exists assessment_validations_doctor_pending_idx
  on public.assessment_validations (doctor_decision)
  where doctor_decision = 'PENDING';

-- RLS policies already limit updates to staff who can view the assessment.
-- Only the new columns need column-level privileges.
grant update (
  doctor_decision, doctor_decision_note, doctor_decision_at, doctor_decision_by
) on public.assessment_validations to authenticated;

comment on column public.assessment_validations.doctor_decision
  is 'Assigned doctor decision: PENDING, ACCEPTED or REJECTED.';
comment on column public.assessment_validations.doctor_decision_note
  is 'Reason supplied by the doctor when declining an assignment.';

commit;
