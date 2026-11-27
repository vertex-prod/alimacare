// Mirrors the enums and tables in alimacare_user/database/schema.sql.

export type AppointmentStatus =
  | "PENDING_RECEPTION"
  | "APPROVED"
  | "WAITING"
  | "CALLED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "ARCHIVED";

export type RespondentRole = "self" | "guardian";

export type VisitPurpose = "consultation" | "diagnostic" | "emergency";

export type PriorityLane = "regular" | "senior_citizen" | "pwd" | "pregnant";

export type PaymentType = "cash" | "hmo" | "philhealth";

export type PatientSex = "Male" | "Female" | "Other";

export type CivilStatus =
  | "single"
  | "married"
  | "widowed"
  | "separated"
  | "other";

export type GuardianRelationship =
  | "parent"
  | "spouse"
  | "child"
  | "relative"
  | "other";

export type RoomPreference = "ward" | "semi_private" | "private" | "suite";

/** A row of `public.patients`, exactly as stored. */
export interface PatientRow {
  id: string;
  patient_id: string;
  respondent_role: RespondentRole;
  visit_purpose: VisitPurpose;
  full_name: string;
  identity_unknown: boolean;
  dob: string | null;
  age: number;
  sex: PatientSex;
  civil_status: CivilStatus | null;
  address: string | null;
  contact_number: string | null;
  chief_complaint: string;
  allergies: string | null;
  has_request_slip: boolean | null;
  priority_lane: PriorityLane;
  payment_type: PaymentType;
  hmo_provider: string | null;
  hmo_no: string | null;
  philhealth_pin: string | null;
  employer_name: string | null;
  room_preference: RoomPreference | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_number: string | null;
  guardian_full_name: string | null;
  guardian_relationship: GuardianRelationship | null;
  guardian_contact_number: string | null;
  guardian_id_type: string | null;
  signature_data: string | null;
  consent_given: boolean;
  department: string;
  status: AppointmentStatus;
  queue_number: string | null;
  queue_date: string | null;
  assigned_doctor: string | null;
  assigned_room: string | null;
  patients_ahead: number | null;
  estimated_wait_minutes: number | null;
  called_time: string | null;
  consultation_start_time: string | null;
  completed_time: string | null;
  registration_datetime: string;
  created_at: string;
  updated_at: string;
}

/** The columns shown in lists (no signature or full PHI). */
export type PatientListItem = Pick<
  PatientRow,
  | "id"
  | "patient_id"
  | "full_name"
  | "identity_unknown"
  | "age"
  | "sex"
  | "visit_purpose"
  | "respondent_role"
  | "chief_complaint"
  | "priority_lane"
  | "payment_type"
  | "department"
  | "status"
  | "queue_number"
  | "queue_date"
  | "assigned_doctor"
  | "assigned_room"
  | "estimated_wait_minutes"
  | "called_time"
  | "consultation_start_time"
  | "completed_time"
  | "registration_datetime"
>;

export interface QueueEvent {
  id: number;
  patient_id: string;
  queue_number: string | null;
  status: AppointmentStatus;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AdminSession {
  username: string;
  expiresAt: number;
}

export interface StatusCounts {
  PENDING_RECEPTION: number;
  APPROVED: number;
  WAITING: number;
  CALLED: number;
  ONGOING: number;
  COMPLETED: number;
  CANCELLED: number;
  NO_SHOW: number;
  ARCHIVED: number;
}

export interface DepartmentSummary {
  code: string;
  total: number;
  active: number;
  pending: number;
  waiting: number;
  serving: number;
  completed: number;
}

export interface DashboardData {
  today: string;
  total: number;
  counts: StatusCounts;
  emergencies: number;
  priority: number;
  averageWaitMinutes: number | null;
  averageServiceMinutes: number | null;
  departments: DepartmentSummary[];
  recent: PatientListItem[];
  weekly: { date: string; label: string; visits: number }[];
}

export interface QueueResponse {
  date: string;
  patients: PatientListItem[];
}

export interface PatientsResponse {
  patients: PatientListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PatientDetailResponse {
  patient: PatientRow;
  events: QueueEvent[];
}
