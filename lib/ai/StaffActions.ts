import type { StaffContext } from "../api-auth";
import type { Db } from "../db/client";
import {
  getAssessmentView,
  getAuditLog,
  logAudit,
  updateAssessment,
  updateValidation,
  type AssessmentView,
  type DoctorDecision,
} from "../db/AssessmentRepository";
import { updatePatientAssessmentState } from "../db/PatientRepository";
import { recommendDoctor, validateDoctorLive } from "./DoctorAssignment";
import { DEPARTMENTS, TRIAGE_LABELS, type Department, type TriageLevel } from "./types";

export class StaffActionError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

async function load(db: Db, id: string): Promise<AssessmentView> {
  const view = await getAssessmentView(db, id);

  if (!view) throw new StaffActionError("Assessment not found.", 404);

  return view;
}

function cleanNote(note: unknown, required: boolean, label: string): string | undefined {
  const text = typeof note === "string" ? note.trim().slice(0, 500) : "";

  if (required && !text) throw new StaffActionError(`${label} is required.`);

  return text || undefined;
}

function toLevel(value: unknown): TriageLevel {
  const n = Number(value);

  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new StaffActionError("Level must be an integer from 1 to 5.");
  }

  return n as TriageLevel;
}

/** Copies the staff-validated decision onto the patient record so the queue
 *  and ticket reflect it. */
async function syncPatient(db: Db, id: string): Promise<AssessmentView> {
  const view = await load(db, id);

  await updatePatientAssessmentState(db, view.patient.uuid, {
    triageLevel: view.effective.level,
    clinicalDepartment: view.effective.department,
    assignedDoctor: view.effective.doctorName ?? undefined,
    aiAssessmentStatus: "completed",
  });

  return view;
}

function stamp(staff: StaffContext, status: "APPROVED" | "OVERRIDDEN" | "FLAGGED") {
  return {
    validation_status: status,
    validated_by: staff.userId,
    validated_by_name: staff.fullName,
    validated_at: new Date().toISOString(),
    alert_acknowledged_by: staff.userId,
    alert_acknowledged_at: new Date().toISOString(),
  };
}

const PENDING_DOCTOR_DECISION = {
  doctor_decision: "PENDING",
  doctor_decision_note: null,
  doctor_decision_at: null,
  doctor_decision_by: null,
};

function doctorDecisionStamp(
  status: DoctorDecision,
  staff: StaffContext,
  note?: string
) {
  return {
    doctor_decision: status,
    doctor_decision_note: note ?? null,
    doctor_decision_at: new Date().toISOString(),
    doctor_decision_by: staff.userId,
  };
}

/** Only the doctor currently assigned to the patient may decide, and only
 *  while the assignment is still awaiting their review. */
function requireAssignedDoctor(view: AssessmentView, staff: StaffContext): void {
  if (staff.role !== "DOCTOR" || !staff.doctorId) {
    throw new StaffActionError("Only the assigned doctor can review this patient.", 403);
  }

  if (view.validation.finalDoctorId !== staff.doctorId) {
    throw new StaffActionError("This patient is not assigned to you.", 403);
  }

  if (view.validation.doctorDecision === "ACCEPTED") {
    throw new StaffActionError("You already accepted this assignment.", 409);
  }

  if (view.validation.doctorDecision === "REJECTED") {
    throw new StaffActionError("This assignment was already declined.", 409);
  }
}

const INACTIVE_PATIENT_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "ARCHIVED",
];

function requireActivePatient(view: AssessmentView): void {
  if (INACTIVE_PATIENT_STATUSES.includes(view.patient.patientStatus)) {
    throw new StaffActionError("This patient visit is already closed.", 409);
  }
}

export async function approveAssessment(id: string, staff: StaffContext, note?: unknown) {
  const db = staff.db;
  const view = await load(db, id);
  const level = view.effective.level as TriageLevel;
  const department = view.effective.department;

  let doctorId = view.effective.doctorId;
  let autoNote: string | undefined;

  // Re-validate the doctor against the live scheduling database before the
  // assignment is finalised.
  if (doctorId) {
    const live = await validateDoctorLive(db, doctorId, level);

    if (!live.ok) {
      autoNote = live.reason;
      doctorId = null;
    }
  }

  if (!doctorId && department) {
    const pick = await recommendDoctor(db, { department, level });

    doctorId = pick.doctor?.id ?? null;
    autoNote = `${autoNote ? autoNote + " " : ""}${pick.reason}`;
  }

  if (doctorId !== view.effective.doctorId) {
    await logAudit(db, {
      assessmentId: id,
      staffUserId: staff.userId,
      staffName: staff.fullName,
      action: "AUTO_REASSIGN_DOCTOR",
      field: "doctor",
      originalValue: view.effective.doctorId,
      newValue: doctorId,
      note: autoNote,
    });
  }

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "APPROVE",
    originalValue: { level: view.aiLevel, department: view.recommendedDepartment },
    newValue: { level, department, doctorId },
    note: cleanNote(note, false, "Note"),
  });

  const patch: Record<string, unknown> = {
    ...stamp(staff, view.validation.status === "OVERRIDDEN" ? "OVERRIDDEN" : "APPROVED"),
    final_level: level,
    final_department: department,
    final_doctor_id: doctorId,
  };

  // A new person taking the case must review it again.
  if (doctorId !== view.effective.doctorId) {
    Object.assign(patch, PENDING_DOCTOR_DECISION);
  }

  await updateValidation(db, id, patch);
  await updateAssessment(db, id, { pending_assignment: doctorId === null });

  return syncPatient(db, id);
}

export async function changeClassification(
  id: string,
  staff: StaffContext,
  newLevel: unknown,
  note: unknown
) {
  const db = staff.db;
  const level = toLevel(newLevel);
  const view = await load(db, id);
  const current = view.effective.level;

  if (level === current) throw new StaffActionError("Classification is unchanged.");

  // Lowering urgency removes safeguards, so a reason is mandatory.
  const reason = cleanNote(note, level > current, "A reason for lowering the classification");

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "CHANGE_CLASSIFICATION",
    field: "level",
    originalValue: { level: current, label: TRIAGE_LABELS[current as TriageLevel] },
    newValue: { level, label: TRIAGE_LABELS[level] },
    note: reason,
  });

  await updateValidation(db, id, { ...stamp(staff, "OVERRIDDEN"), final_level: level });

  return syncPatient(db, id);
}

export async function changeDepartment(
  id: string,
  staff: StaffContext,
  newDepartment: unknown,
  note: unknown
) {
  const db = staff.db;
  const department = DEPARTMENTS.find(
    (d) => d.toLowerCase() === String(newDepartment ?? "").trim().toLowerCase()
  ) as Department | undefined;

  if (!department) throw new StaffActionError("Unknown department.");

  const view = await load(db, id);

  if (department === view.effective.department) {
    throw new StaffActionError("Department is unchanged.");
  }

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "CHANGE_DEPARTMENT",
    field: "department",
    originalValue: view.effective.department,
    newValue: department,
    note: cleanNote(note, false, "Note"),
  });

  // The previous doctor belongs to the old department, so pick again from
  // live availability for the new one.
  const pick = await recommendDoctor(db, {
    department,
    level: view.effective.level as TriageLevel,
  });

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "AUTO_REASSIGN_DOCTOR",
    field: "doctor",
    originalValue: view.effective.doctorId,
    newValue: pick.doctor?.id ?? null,
    note: pick.reason,
  });

  await updateValidation(db, id, {
    ...stamp(staff, "OVERRIDDEN"),
    final_department: department,
    final_doctor_id: pick.doctor?.id ?? null,
    ...PENDING_DOCTOR_DECISION,
  });
  await updateAssessment(db, id, { pending_assignment: pick.doctor === null });

  return syncPatient(db, id);
}

export async function reassignDoctor(
  id: string,
  staff: StaffContext,
  doctorId: string,
  options: { override: boolean; note: unknown }
) {
  const db = staff.db;
  const view = await load(db, id);
  const level = view.effective.level as TriageLevel;
  const live = await validateDoctorLive(db, doctorId, level);

  if (!live.doctor) throw new StaffActionError(live.reason, 404);

  let overridden = false;

  if (!live.ok) {
    // Critical and emergency cases may bypass ordinary eligibility rules, but
    // only deliberately and only by reception/admin staff.
    const canOverride =
      level <= 2 && options.override && (staff.role === "ADMIN" || staff.role === "RECEPTION");

    if (!canOverride) {
      throw new StaffActionError(
        `${live.reason} ${level <= 2 ? "Level 1-2 cases can be overridden by reception or admin staff." : ""}`.trim(),
        409
      );
    }

    overridden = true;
  }

  if (doctorId === view.effective.doctorId) {
    throw new StaffActionError("That doctor is already assigned.");
  }

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: overridden ? "REASSIGN_DOCTOR_OVERRIDE" : "REASSIGN_DOCTOR",
    field: "doctor",
    originalValue: { id: view.effective.doctorId, name: view.effective.doctorName },
    newValue: { id: doctorId, name: live.doctor.fullName, status: live.doctor.status },
    note: cleanNote(options.note, overridden, "A reason for the override"),
  });

  await updateValidation(db, id, {
    ...stamp(staff, "OVERRIDDEN"),
    final_doctor_id: doctorId,
    ...PENDING_DOCTOR_DECISION,
  });
  await updateAssessment(db, id, { pending_assignment: false });

  return syncPatient(db, id);
}

export async function escalateAssessment(
  id: string,
  staff: StaffContext,
  options: { level?: unknown; note: unknown }
) {
  const db = staff.db;
  const view = await load(db, id);
  const current = view.effective.level;

  if (current === 1) throw new StaffActionError("Patient is already at the highest priority.");

  const target =
    options.level === undefined || options.level === null || options.level === ""
      ? ((current - 1) as TriageLevel)
      : toLevel(options.level);

  if (target >= current) {
    throw new StaffActionError("Escalation must move to a more urgent level.");
  }

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "ESCALATE",
    field: "level",
    originalValue: { level: current, label: TRIAGE_LABELS[current as TriageLevel] },
    newValue: { level: target, label: TRIAGE_LABELS[target] },
    note: cleanNote(options.note, false, "Note"),
  });

  await updateValidation(db, id, { ...stamp(staff, "OVERRIDDEN"), final_level: target });
  await updateAssessment(db, id, { escalated: target <= 2 || view.escalated });

  return syncPatient(db, id);
}

export async function flagAssessment(id: string, staff: StaffContext, note: unknown) {
  const db = staff.db;
  const view = await load(db, id);

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "FLAG_FOR_REVIEW",
    originalValue: { status: view.validation.status },
    newValue: { status: "FLAGGED" },
    note: cleanNote(note, true, "A reason for flagging"),
  });

  await updateValidation(db, id, stamp(staff, "FLAGGED"));
  await updateAssessment(db, id, { needs_human_review: true });

  return load(db, id);
}

/** The assigned doctor accepts the patient. The visit becomes an active queue
 *  entry so the doctor can call the patient when ready. */
export async function acceptPatient(id: string, staff: StaffContext) {
  const db = staff.db;
  const view = await load(db, id);

  requireAssignedDoctor(view, staff);
  requireActivePatient(view);

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "DOCTOR_ACCEPT_PATIENT",
    field: "doctor_decision",
    originalValue: "PENDING",
    newValue: "ACCEPTED",
  });

  await updateValidation(db, id, doctorDecisionStamp("ACCEPTED", staff));
  await updateAssessment(db, id, { pending_assignment: false });

  await updatePatientAssessmentState(db, view.patient.uuid, {
    triageLevel: view.effective.level,
    clinicalDepartment: view.effective.department,
    assignedDoctor: view.effective.doctorName ?? undefined,
    aiAssessmentStatus: "completed",
    status: "WAITING",
  });

  return load(db, id);
}

/** The assigned doctor declines the assignment. The patient returns to the
 *  reception queue with no doctor, while the audit log keeps who declined and
 *  why. */
export async function declinePatient(
  id: string,
  staff: StaffContext,
  note: unknown
): Promise<{ assessment: AssessmentView; audit: Awaited<ReturnType<typeof getAuditLog>> }> {
  const db = staff.db;
  const view = await load(db, id);

  requireAssignedDoctor(view, staff);
  requireActivePatient(view);

  const reason = cleanNote(note, true, "A reason for declining the assignment");

  await logAudit(db, {
    assessmentId: id,
    staffUserId: staff.userId,
    staffName: staff.fullName,
    action: "DOCTOR_DECLINE_PATIENT",
    field: "doctor_decision",
    originalValue: "PENDING",
    newValue: "REJECTED",
    note: reason,
  });

  await updateValidation(db, id, doctorDecisionStamp("REJECTED", staff, reason));
  await updateAssessment(db, id, { pending_assignment: true });

  // Read the response BEFORE releasing the patient: once patients.assigned_doctor
  // is cleared, row-level security correctly hides the record from this doctor.
  const assessment = await load(db, id);
  const audit = await getAuditLog(db, [id]);

  await updatePatientAssessmentState(db, view.patient.uuid, {
    assignedDoctor: null,
    status: "PENDING_RECEPTION",
  });

  return { assessment, audit };
}
