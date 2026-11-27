import type { Db } from "./client";
import type { ClinicalInput } from "../ai/types";
import type { AppointmentStatus } from "../types";

export type AiAssessmentStatus =
  | "not_started"
  | "pending"
  | "completed"
  | "failed"
  | "needs_review";

/** Loads only the clinical facts used for assessment (no contact, address or
 *  payment details) plus the internal id. */
export async function getClinicalInput(
  db: Db,
  patientUuid: string
): Promise<ClinicalInput | null> {
  const { data, error } = await db
    .from("patients")
    .select(
      "visit_purpose, age, sex, priority_lane, chief_complaint, symptom_duration, symptom_severity, medical_history, existing_conditions, current_medications, allergies"
    )
    .eq("id", patientUuid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    visitPurpose: data.visit_purpose,
    age: data.age,
    sex: data.sex,
    priorityLane: data.priority_lane,
    chiefComplaint: data.chief_complaint,
    symptomDuration: data.symptom_duration ?? undefined,
    symptomSeverity: data.symptom_severity ?? undefined,
    medicalHistory: data.medical_history ?? undefined,
    existingConditions: data.existing_conditions ?? undefined,
    currentMedications: data.current_medications ?? undefined,
    allergies: data.allergies ?? undefined,
  };
}

export async function updatePatientAssessmentState(
  db: Db,
  patientUuid: string,
  patch: {
    aiAssessmentStatus?: AiAssessmentStatus;
    triageLevel?: number;
    clinicalDepartment?: string | null;
    assignedDoctor?: string | null;
    status?: AppointmentStatus;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};

  if (patch.aiAssessmentStatus) row.ai_assessment_status = patch.aiAssessmentStatus;
  if (patch.triageLevel !== undefined) row.triage_level = patch.triageLevel;
  if (patch.clinicalDepartment !== undefined) {
    row.clinical_department = patch.clinicalDepartment;
  }
  if (patch.assignedDoctor !== undefined) row.assigned_doctor = patch.assignedDoctor;
  if (patch.status !== undefined) row.status = patch.status;

  if (Object.keys(row).length === 0) return;

  const { error } = await db.from("patients").update(row).eq("id", patientUuid);

  if (error) throw new Error(error.message);
}

export async function patientExists(db: Db, patientUuid: string): Promise<boolean> {
  const { data } = await db
    .from("patients")
    .select("id")
    .eq("id", patientUuid)
    .maybeSingle();

  return Boolean(data);
}
