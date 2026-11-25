export interface PublicDoctor {
  id: string;
  fullName: string;
  specialization: string;
  assignedRoom: string;
}

export interface Patient {
  id: string;
  patientId: string;
  fullName: string;
  age: number;
  sex: string;
  contactNumber: string;
  classification: PatientClassification;
  serviceType: string;
  recommendedDoctor?: string;
  appointmentTime?: string;
  status: AppointmentStatus;
  queueNumber?: number;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
  completedTime?: string;
  assignedDoctor?: string;
}

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

export type PatientClassification = "I" | "II" | "III";

export interface PublicPatient {
  patientId: string;
  fullName: string;
  status: AppointmentStatus;
  queueNumber?: number;
  assignedRoom?: string;
  estimatedWaitMinutes?: number;
  completedTime?: string;
  assignedDoctor?: string;
  patientsAhead?: number;
}