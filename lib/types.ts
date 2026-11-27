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

export type PriorityLane =
  | "regular"
  | "senior_citizen"
  | "pwd"
  | "pregnant";

export type PaymentType = "cash" | "hmo" | "philhealth";

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

export type RoomPreference =
  | "ward"
  | "semi_private"
  | "private"
  | "suite";

export interface Patient {
  id: string;
  patientId: string;
  respondentRole: RespondentRole;
  visitPurpose: VisitPurpose;
  fullName: string;
  identityUnknown: boolean;
  dob?: string;
  age: number;
  sex: string;
  civilStatus?: CivilStatus;
  address?: string;
  contactNumber?: string;
  chiefComplaint: string;
  allergies?: string;
  hasRequestSlip?: boolean;
  priorityLane: PriorityLane;
  paymentType: PaymentType;
  hmoProvider?: string;
  hmoNo?: string;
  philhealthPin?: string;
  employerName?: string;
  roomPreference?: RoomPreference;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  guardianFullName?: string;
  guardianRelationship?: GuardianRelationship;
  guardianContactNumber?: string;
  guardianIdType?: string;
  consentGiven: boolean;
  status: AppointmentStatus;
  department?: string;
  queueNumber?: string;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
  patientsAhead?: number;
  queuePosition?: number;
  completedTime?: string;
  assignedDoctor?: string;
}

export interface CreatePatientInput {
  patientId?: string;
  respondentRole: RespondentRole;
  visitPurpose: VisitPurpose;
  fullName: string;
  identityUnknown?: boolean;
  dob?: string;
  age: number;
  sex: string;
  civilStatus?: CivilStatus;
  address?: string;
  contactNumber?: string;
  chiefComplaint: string;
  allergies?: string;
  symptomDuration?: string;
  symptomSeverity?: number;
  medicalHistory?: string;
  existingConditions?: string;
  currentMedications?: string;
  hasRequestSlip?: boolean;
  priorityLane: PriorityLane;
  paymentType: PaymentType;
  hmoProvider?: string;
  hmoNo?: string;
  philhealthPin?: string;
  employerName?: string;
  roomPreference?: RoomPreference;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  guardianFullName?: string;
  guardianRelationship?: GuardianRelationship;
  guardianContactNumber?: string;
  guardianIdType?: string;
  signatureData?: string;
  consentGiven: boolean;
  status?: AppointmentStatus;
  queueNumber?: string;
  assignedDoctor?: string;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
}

export interface PublicPatient {
  patientId: string;
  fullName: string;
  status: AppointmentStatus;
  visitPurpose?: VisitPurpose;
  department?: string;
  priorityLane?: PriorityLane;
  queueNumber?: string;
  queuePosition?: number;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
  patientsAhead?: number;
  completedTime?: string;
  assignedDoctor?: string;
  /** Provisional or staff-validated triage level (1 = most urgent). */
  triageLevel?: number;
}
