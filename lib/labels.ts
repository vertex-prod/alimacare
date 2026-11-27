import type {
  AppointmentStatus,
  CivilStatus,
  GuardianRelationship,
  PaymentType,
  PriorityLane,
  RespondentRole,
  RoomPreference,
  VisitPurpose,
} from "./types";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export const STATUSES: AppointmentStatus[] = [
  "PENDING_RECEPTION",
  "APPROVED",
  "WAITING",
  "CALLED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "ARCHIVED",
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING_RECEPTION: "Pending reception",
  APPROVED: "Approved",
  WAITING: "Waiting",
  CALLED: "Called",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  ARCHIVED: "Archived",
};

export const STATUS_TONES: Record<AppointmentStatus, BadgeTone> = {
  PENDING_RECEPTION: "warning",
  APPROVED: "info",
  WAITING: "warning",
  CALLED: "info",
  ONGOING: "success",
  COMPLETED: "success",
  CANCELLED: "muted",
  NO_SHOW: "danger",
  ARCHIVED: "muted",
};

/** Patients still in line or being served. */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "PENDING_RECEPTION",
  "APPROVED",
  "WAITING",
  "CALLED",
  "ONGOING",
];

export const TERMINAL_STATUSES: AppointmentStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "ARCHIVED",
];

/**
 * Allowed next statuses from each status. Admins may also reopen a closed
 * record back to WAITING if it was closed by mistake.
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> =
  {
    PENDING_RECEPTION: ["APPROVED", "WAITING", "CANCELLED", "NO_SHOW"],
    APPROVED: ["WAITING", "CALLED", "CANCELLED", "NO_SHOW"],
    WAITING: ["CALLED", "CANCELLED", "NO_SHOW"],
    CALLED: ["ONGOING", "WAITING", "NO_SHOW", "CANCELLED"],
    ONGOING: ["COMPLETED", "CALLED", "CANCELLED"],
    COMPLETED: ["ARCHIVED", "ONGOING"],
    CANCELLED: ["WAITING", "ARCHIVED"],
    NO_SHOW: ["WAITING", "ARCHIVED"],
    ARCHIVED: ["WAITING"],
  };

export const STATUS_ACTION_LABELS: Partial<Record<AppointmentStatus, string>> = {
  APPROVED: "Approve",
  WAITING: "Send to waiting",
  CALLED: "Call",
  ONGOING: "Start",
  COMPLETED: "Complete",
  CANCELLED: "Cancel",
  NO_SHOW: "Mark no-show",
  ARCHIVED: "Archive",
};

export const VISIT_PURPOSE_LABELS: Record<VisitPurpose, string> = {
  consultation: "Check-up / Consultation",
  diagnostic: "Diagnostic Assessment",
  emergency: "Emergency / Admission",
};

export const VISIT_PURPOSE_SHORT_LABELS: Record<VisitPurpose, string> = {
  consultation: "Consultation",
  diagnostic: "Diagnostic",
  emergency: "Emergency",
};

export const RESPONDENT_ROLE_LABELS: Record<RespondentRole, string> = {
  self: "Self",
  guardian: "Guardian",
};

export const PRIORITY_LANE_LABELS: Record<PriorityLane, string> = {
  regular: "Regular",
  senior_citizen: "Senior Citizen",
  pwd: "PWD",
  pregnant: "Pregnant",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  cash: "Cash",
  hmo: "HMO",
  philhealth: "PhilHealth",
};

export const CIVIL_STATUS_LABELS: Record<CivilStatus, string> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  separated: "Separated",
  other: "Other",
};

export const GUARDIAN_RELATIONSHIP_LABELS: Record<GuardianRelationship, string> =
  {
    parent: "Parent",
    spouse: "Spouse",
    child: "Child",
    relative: "Relative",
    other: "Other",
  };

export const ROOM_PREFERENCE_LABELS: Record<RoomPreference, string> = {
  ward: "Ward",
  semi_private: "Semi-private",
  private: "Private",
  suite: "Suite",
};

/** Departments the database assigns from the visit purpose. */
export const DEFAULT_DEPARTMENTS = ["OPD", "LAB", "ER"] as const;

export const DEPARTMENT_LABELS: Record<string, string> = {
  OPD: "Outpatient Department",
  LAB: "Laboratory & Diagnostics",
  ER: "Emergency Room",
};

export function departmentLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return DEPARTMENT_LABELS[code] ?? code;
}
