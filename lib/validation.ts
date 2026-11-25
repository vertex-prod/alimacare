import type { Patient, PatientClassification } from "./types";

export function parseCreatePatientInput(body: Record<string, unknown>): {
  fullName: string;
  age: number;
  sex: string;
  contactNumber: string;
  classification: PatientClassification;
  serviceType: string;
  recommendedDoctor: string;
  appointmentTime: string;
} {
  const input = (body ?? {}) as Record<string, unknown>;

  const fullName = String(input.fullName ?? "").trim();
  const age = Number(input.age ?? 0);
  const sex = String(input.sex ?? "Male");
  const contactNumber = String(input.contactNumber ?? "").trim();
  const classification = (
    String(input.classification ?? "I") as PatientClassification
  );
  const serviceType = String(input.serviceType ?? "Check-up / Consultation");
  const recommendedDoctor = String(input.recommendedDoctor ?? "");
  const appointmentTime = String(input.appointmentTime ?? "");

  // Basic validation – throw descriptive errors for invalid input.
  if (!fullName) throw new Error("Full name is required.");
  if (!Number.isFinite(age) || age <= 0)
    throw new Error("A valid age is required.");
  if (!contactNumber) throw new Error("Contact number is required.");
  if (!["Male", "Female", "Other"].includes(sex))
    throw new Error("Sex must be Male, Female, or Other.");
  if (classification !== "I" && classification !== "II" && classification !== "III")
    throw new Error("Invalid classification.");

  return {
    fullName,
    age,
    sex,
    contactNumber,
    classification,
    serviceType,
    recommendedDoctor,
    appointmentTime,
  };
}

export function parsePatientPatch(body: Record<string, unknown>): {
  disposition?: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED";
  details?: Partial<Pick<Patient, "queueNumber" | "assignedRoom" | "assignedDoctor" | "estimatedWaitMinutes" | "status">>;
} {
  const input = body ?? {};
  const patch: {
    disposition?: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED";
    details?: Partial<Pick<Patient, "queueNumber" | "assignedRoom" | "assignedDoctor" | "estimatedWaitMinutes" | "status">>;
  } = {};

  if (input.disposition) {
    patch.disposition = input.disposition as "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED";
  }

  if (input.details) {
    patch.details = input.details as Partial<Pick<Patient, "queueNumber" | "assignedRoom" | "assignedDoctor" | "estimatedWaitMinutes" | "status">>;
  }

  return patch;
}

export function parseUuid(rawId: string | null | undefined, entity: string): string {
  if (!rawId) throw new Error(`${entity} ID is required`);
  if (rawId === "undefined" || rawId === "null") throw new Error(`Invalid ${entity} ID`);
  return rawId;
}

export function parseDoctorName(value: unknown): string {
  return value ? String(value).trim() : "";
}

export function parseRoom(value: unknown): string {
  return value ? String(value).trim() : "";
}