import type { Db } from "./client";
import { TRIAGE_LABELS, type TriageLevel } from "../ai/types";

export type ValidationStatus = "PENDING" | "APPROVED" | "OVERRIDDEN" | "FLAGGED";

export interface AssessmentRow {
  id: string;
  patient_uuid: string;
  version: number;
  status: "completed" | "failed";
  analysis_source: string;
  primary_symptoms: string[];
  secondary_symptoms: string[];
  relevant_history: string[];
  potential_concerns: string[];
  warning_signs: string[];
  recommended_action: string | null;
  confidence: string | null;
  missing_info: string[];
  triage_level: number;
  rule_floor_level: number | null;
  classification_reason: string;
  rule_flags: unknown;
  recommended_department: string | null;
  department_reason: string | null;
  recommended_doctor_id: string | null;
  doctor_availability_snapshot: unknown;
  pending_assignment: boolean;
  needs_human_review: boolean;
  escalated: boolean;
  model: string | null;
  error_detail: string | null;
  created_at: string;
}

export type NewAssessment = Omit<
  AssessmentRow,
  "id" | "created_at" | "version" | "patient_uuid"
>;

export interface AssessmentView {
  id: string;
  version: number;
  createdAt: string;
  status: "completed" | "failed";
  analysisSource: string;
  patient: {
    uuid: string;
    patientId: string;
    fullName: string;
    age: number;
    sex: string;
    visitPurpose: string;
    chiefComplaint: string;
    allergies: string | null;
    symptomDuration: string | null;
    symptomSeverity: number | null;
    medicalHistory: string | null;
    existingConditions: string | null;
    currentMedications: string | null;
    queueNumber: string | null;
    patientStatus: string;
    assignedDoctor: string | null;
    priorityLane: string;
  };
  primarySymptoms: string[];
  secondarySymptoms: string[];
  relevantHistory: string[];
  potentialConcerns: string[];
  warningSigns: string[];
  recommendedAction: string | null;
  confidence: string | null;
  missingInformation: string[];
  aiLevel: number;
  ruleFloorLevel: number | null;
  classificationReason: string;
  ruleFlags: { id: string; label: string; level: number; matched?: string }[];
  recommendedDepartment: string | null;
  departmentReason: string | null;
  recommendedDoctor: { id: string; fullName: string; specialty: string } | null;
  doctorCandidates: unknown;
  pendingAssignment: boolean;
  needsHumanReview: boolean;
  escalated: boolean;
  model: string | null;
  error: string | null;
  validation: {
    status: ValidationStatus;
    finalLevel: number | null;
    finalDepartment: string | null;
    finalDoctorId: string | null;
    finalDoctorName: string | null;
    validatedByName: string | null;
    validatedAt: string | null;
    alertAcknowledgedAt: string | null;
  };
  /** What the system will act on: staff decision where present, else the AI's. */
  effective: {
    level: number;
    label: string;
    department: string | null;
    doctorId: string | null;
    doctorName: string | null;
  };
}

const PATIENT_COLUMNS =
  "patient_id, full_name, age, sex, visit_purpose, chief_complaint, allergies, symptom_duration, symptom_severity, medical_history, existing_conditions, current_medications, queue_number, status, assigned_doctor, priority_lane";

const VIEW_SELECT = `*, patients!inner(${PATIENT_COLUMNS}), assessment_validations(*), recommended_doctor:doctors!ai_assessments_recommended_doctor_id_fkey(id, full_name, specialty)`;

type Joined = AssessmentRow & {
  patients: Record<string, unknown> | Record<string, unknown>[];
  assessment_validations: Record<string, unknown> | Record<string, unknown>[] | null;
  recommended_doctor: Record<string, unknown> | Record<string, unknown>[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;

  return value ?? null;
}

async function doctorNames(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];

  if (unique.length === 0) return new Map();

  const { data } = await db.from("doctors").select("id, full_name").in("id", unique);

  return new Map((data ?? []).map((d) => [d.id as string, d.full_name as string]));
}

function mapView(row: Joined, names: Map<string, string>): AssessmentView {
  const p = one(row.patients) ?? {};
  const v = one(row.assessment_validations) ?? {};
  const doc = one(row.recommended_doctor);

  const finalLevel = (v.final_level as number | null | undefined) ?? null;
  const finalDoctorId = (v.final_doctor_id as string | null | undefined) ?? null;
  const finalDepartment = (v.final_department as string | null | undefined) ?? null;

  const effectiveLevel = finalLevel ?? row.triage_level;
  const effectiveDoctorId = finalDoctorId ?? row.recommended_doctor_id;

  return {
    id: row.id,
    version: row.version,
    createdAt: row.created_at,
    status: row.status,
    analysisSource: row.analysis_source,
    patient: {
      uuid: row.patient_uuid,
      patientId: p.patient_id as string,
      fullName: p.full_name as string,
      age: p.age as number,
      sex: p.sex as string,
      visitPurpose: p.visit_purpose as string,
      chiefComplaint: p.chief_complaint as string,
      allergies: (p.allergies as string | null) ?? null,
      symptomDuration: (p.symptom_duration as string | null) ?? null,
      symptomSeverity: (p.symptom_severity as number | null) ?? null,
      medicalHistory: (p.medical_history as string | null) ?? null,
      existingConditions: (p.existing_conditions as string | null) ?? null,
      currentMedications: (p.current_medications as string | null) ?? null,
      queueNumber: (p.queue_number as string | null) ?? null,
      patientStatus: p.status as string,
      assignedDoctor: (p.assigned_doctor as string | null) ?? null,
      priorityLane: p.priority_lane as string,
    },
    primarySymptoms: row.primary_symptoms,
    secondarySymptoms: row.secondary_symptoms,
    relevantHistory: row.relevant_history,
    potentialConcerns: row.potential_concerns,
    warningSigns: row.warning_signs,
    recommendedAction: row.recommended_action,
    confidence: row.confidence,
    missingInformation: row.missing_info,
    aiLevel: row.triage_level,
    ruleFloorLevel: row.rule_floor_level,
    classificationReason: row.classification_reason,
    ruleFlags: Array.isArray(row.rule_flags) ? (row.rule_flags as AssessmentView["ruleFlags"]) : [],
    recommendedDepartment: row.recommended_department,
    departmentReason: row.department_reason,
    recommendedDoctor: doc
      ? {
          id: doc.id as string,
          fullName: doc.full_name as string,
          specialty: doc.specialty as string,
        }
      : null,
    doctorCandidates: row.doctor_availability_snapshot,
    pendingAssignment: row.pending_assignment,
    needsHumanReview: row.needs_human_review,
    escalated: row.escalated,
    model: row.model,
    error: row.error_detail,
    validation: {
      status: ((v.validation_status as ValidationStatus | undefined) ?? "PENDING"),
      finalLevel,
      finalDepartment,
      finalDoctorId,
      finalDoctorName: finalDoctorId ? names.get(finalDoctorId) ?? null : null,
      validatedByName: (v.validated_by_name as string | null | undefined) ?? null,
      validatedAt: (v.validated_at as string | null | undefined) ?? null,
      alertAcknowledgedAt: (v.alert_acknowledged_at as string | null | undefined) ?? null,
    },
    effective: {
      level: effectiveLevel,
      label: TRIAGE_LABELS[effectiveLevel as TriageLevel],
      department: finalDepartment ?? row.recommended_department,
      doctorId: effectiveDoctorId,
      doctorName: effectiveDoctorId
        ? names.get(effectiveDoctorId) ?? (doc?.full_name as string | undefined) ?? null
        : null,
    },
  };
}

async function toViews(db: Db, rows: Joined[]): Promise<AssessmentView[]> {
  const ids = rows.flatMap((r) => {
    const v = one(r.assessment_validations);
    const list: string[] = [];

    if (v?.final_doctor_id) list.push(v.final_doctor_id as string);
    if (r.recommended_doctor_id) list.push(r.recommended_doctor_id);

    return list;
  });
  const names = await doctorNames(db, ids);

  return rows.map((r) => mapView(r, names));
}

export async function nextVersion(db: Db, patientUuid: string): Promise<number> {
  const { data, error } = await db
    .from("ai_assessments")
    .select("version")
    .eq("patient_uuid", patientUuid)
    .order("version", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  return ((data?.[0]?.version as number | undefined) ?? 0) + 1;
}

export async function insertAssessment(
  db: Db,
  patientUuid: string,
  data: NewAssessment
): Promise<AssessmentRow> {
  // Retry once on a version collision from a concurrent run.
  for (let attempt = 0; attempt < 2; attempt++) {
    const version = await nextVersion(db, patientUuid);
    const { data: row, error } = await db
      .from("ai_assessments")
      .insert({ ...data, patient_uuid: patientUuid, version })
      .select()
      .single();

    if (!error && row) {
      const { error: validationError } = await db
        .from("assessment_validations")
        .insert({ assessment_id: row.id, validation_status: "PENDING" });

      if (validationError) throw new Error(validationError.message);

      return row as AssessmentRow;
    }

    if (error?.code !== "23505") throw new Error(error?.message ?? "Insert failed.");
  }

  throw new Error("Could not allocate an assessment version.");
}

export async function updateAssessment(
  db: Db,
  id: string,
  patch: Partial<NewAssessment>
): Promise<void> {
  const { error } = await db.from("ai_assessments").update(patch).eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getAssessmentView(db: Db, id: string): Promise<AssessmentView | null> {
  const { data, error } = await db
    .from("ai_assessments")
    .select(VIEW_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return (await toViews(db, [data as unknown as Joined]))[0];
}

/** Latest assessment for a patient, addressed by internal UUID or by the
 *  readable patient reference. */
export async function getLatestAssessmentForPatient(
  db: Db,
  patientKey: string
): Promise<AssessmentView | null> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientKey);

  let patientUuid = patientKey;

  if (!isUuid) {
    const { data } = await db
      .from("patients")
      .select("id")
      .eq("patient_id", patientKey)
      .maybeSingle();

    if (!data) return null;
    patientUuid = data.id as string;
  }

  const { data, error } = await db
    .from("ai_assessments")
    .select(VIEW_SELECT)
    .eq("patient_uuid", patientUuid)
    .order("version", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  return (await toViews(db, [data[0] as unknown as Joined]))[0];
}

const ACTIVE_PATIENT_STATUSES = ["PENDING_RECEPTION", "APPROVED", "WAITING", "CALLED", "ONGOING"];

/** Latest assessment of every active patient, most urgent first. */
export async function listActiveAssessments(db: Db, limit = 100): Promise<AssessmentView[]> {
  const { data, error } = await db
    .from("ai_assessments")
    .select(VIEW_SELECT)
    .in("patients.status", ACTIVE_PATIENT_STATUSES)
    .order("created_at", { ascending: false })
    .limit(limit * 3);

  if (error) throw new Error(error.message);

  // Keep only the newest version per patient.
  const seen = new Set<string>();
  const latest: Joined[] = [];

  for (const row of (data ?? []) as unknown as Joined[]) {
    if (seen.has(row.patient_uuid)) continue;
    seen.add(row.patient_uuid);
    latest.push(row);
  }

  const views = await toViews(db, latest.slice(0, limit));

  return views.sort(
    (a, b) =>
      a.effective.level - b.effective.level ||
      a.createdAt.localeCompare(b.createdAt)
  );
}

/** Level 1-2 assessments that no staff member has acknowledged yet. */
export async function listUnacknowledgedAlerts(db: Db): Promise<AssessmentView[]> {
  const views = await listActiveAssessments(db, 200);

  return views.filter(
    (v) =>
      v.effective.level <= 2 &&
      v.validation.status === "PENDING" &&
      !v.validation.alertAcknowledgedAt
  );
}

export async function getAuditLog(db: Db, assessmentIds: string[]) {
  if (assessmentIds.length === 0) return [];

  const { data, error } = await db
    .from("assessment_audit_log")
    .select("id, assessment_id, staff_name, action, field, original_value, new_value, note, created_at")
    .in("assessment_id", assessmentIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function logAudit(db: Db, entry: {
  assessmentId: string;
  staffUserId: string | null;
  staffName: string;
  action: string;
  field?: string;
  originalValue?: unknown;
  newValue?: unknown;
  note?: string;
}): Promise<void> {
  const { error } = await db.from("assessment_audit_log").insert({
    assessment_id: entry.assessmentId,
    staff_user_id: entry.staffUserId,
    staff_name: entry.staffName,
    action: entry.action,
    field: entry.field ?? null,
    original_value: entry.originalValue === undefined ? null : entry.originalValue,
    new_value: entry.newValue === undefined ? null : entry.newValue,
    note: entry.note ?? null,
  });

  // An unrecorded manual change is unacceptable: surface the failure.
  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}

export async function updateValidation(
  db: Db,
  assessmentId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await db
    .from("assessment_validations")
    .update(patch)
    .eq("assessment_id", assessmentId);

  if (error) throw new Error(error.message);
}
