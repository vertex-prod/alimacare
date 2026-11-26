import type {
  CivilStatus,
  CreatePatientInput,
  GuardianRelationship,
  Patient,
  PaymentType,
  PriorityLane,
  RespondentRole,
  RoomPreference,
  VisitPurpose,
} from "./types";

const PHONE_PATTERN = /^[0-9+() -]{7,20}$/;
const MAX_SIGNATURE_LENGTH = 800_000;

function requiredString(
  value: unknown,
  label: string,
  maxLength: number
): string {
  const text = String(value ?? "").trim();

  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function optionalString(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  const text = String(value ?? "").trim();

  if (!text) return undefined;
  if (text.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return text;
}

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T {
  const text = String(value ?? "").trim() as T;

  if (!allowed.includes(text)) {
    throw new Error(`Invalid ${label.toLowerCase()}.`);
  }

  return text;
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T | undefined {
  const text = String(value ?? "").trim();

  if (!text) return undefined;

  return parseEnum(text, allowed, label);
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;

  return undefined;
}

function parsePhone(value: unknown, label: string): string | undefined {
  const phone = optionalString(value, label, 20);

  if (phone && !PHONE_PATTERN.test(phone)) {
    throw new Error(
      `${label} must be 7–20 characters (digits, spaces, +, -, or parentheses).`
    );
  }

  return phone;
}

function parseDob(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();

  if (!raw) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Date of birth must use the YYYY-MM-DD format.");
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Date of birth is not a valid date.");
  }

  if (date.getTime() > Date.now()) {
    throw new Error("Date of birth cannot be in the future.");
  }

  return raw;
}

function ageFromDob(dob: string): number {
  const birth = new Date(`${dob}T00:00:00Z`);
  const today = new Date();

  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const month = today.getUTCMonth() - birth.getUTCMonth();

  if (month < 0 || (month === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function parseSignature(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  const signature = String(value);

  if (!signature.startsWith("data:image/png;base64,")) {
    throw new Error("Signature must be a PNG image.");
  }

  if (signature.length > MAX_SIGNATURE_LENGTH) {
    throw new Error("Signature image is too large. Please clear and try again.");
  }

  return signature;
}

const RESPONDENT_ROLES = ["self", "guardian"] as const;
const VISIT_PURPOSES = ["consultation", "diagnostic", "emergency"] as const;
const PRIORITY_LANES = [
  "regular",
  "senior_citizen",
  "pwd",
  "pregnant",
] as const;
const PAYMENT_TYPES = ["cash", "hmo", "philhealth"] as const;
const CIVIL_STATUSES = [
  "single",
  "married",
  "widowed",
  "separated",
  "other",
] as const;
const GUARDIAN_RELATIONSHIPS = [
  "parent",
  "spouse",
  "child",
  "relative",
  "other",
] as const;
const ROOM_PREFERENCES = ["ward", "semi_private", "private", "suite"] as const;

export function parseCreatePatientInput(
  body: Record<string, unknown>
): CreatePatientInput {
  const input = (body ?? {}) as Record<string, unknown>;

  const respondentRole = parseEnum<RespondentRole>(
    input.respondentRole,
    RESPONDENT_ROLES,
    "Respondent role"
  );
  const visitPurpose = parseEnum<VisitPurpose>(
    input.visitPurpose,
    VISIT_PURPOSES,
    "Visit purpose"
  );
  const isEmergency = visitPurpose === "emergency";

  const identityUnknown =
    isEmergency && parseBoolean(input.identityUnknown) === true;
  const fullName = identityUnknown
    ? "Unknown / Unconscious"
    : requiredString(input.fullName, "Full name", 120);

  const dob = parseDob(input.dob);

  if (!dob && !isEmergency) {
    throw new Error("Date of birth is required.");
  }

  let age: number;

  if (dob) {
    age = ageFromDob(dob);
  } else {
    age = Number(input.age ?? NaN);

    if (!Number.isInteger(age) || age < 0 || age > 150) {
      throw new Error("Enter an approximate age or a date of birth.");
    }
  }

  const sex = String(input.sex ?? "").trim();

  if (!["Male", "Female", "Other"].includes(sex)) {
    throw new Error("Sex must be Male, Female, or Other.");
  }

  const civilStatus = isEmergency
    ? undefined
    : parseEnum<CivilStatus>(
        input.civilStatus,
        CIVIL_STATUSES,
        "Civil status"
      );

  const address = isEmergency
    ? optionalString(input.address, "Address", 240)
    : requiredString(input.address, "Address", 240);

  const contactNumber = parsePhone(input.contactNumber, "Mobile number");

  if (!isEmergency && respondentRole === "self" && !contactNumber) {
    throw new Error("Mobile number is required when filling out for yourself.");
  }

  const chiefComplaint = requiredString(
    input.chiefComplaint,
    isEmergency ? "Symptoms / incident" : "Chief complaint",
    500
  );
  const allergies = optionalString(input.allergies, "Known allergies", 500);

  let hasRequestSlip: boolean | undefined;

  if (visitPurpose === "diagnostic") {
    hasRequestSlip = parseBoolean(input.hasRequestSlip);

    if (hasRequestSlip === undefined) {
      throw new Error(
        "Please indicate whether you have a doctor's request slip."
      );
    }
  }

  const priorityLane = isEmergency
    ? "regular"
    : parseEnum<PriorityLane>(
        input.priorityLane ?? "regular",
        PRIORITY_LANES,
        "Priority lane"
      );

  const paymentType = parseEnum<PaymentType>(
    input.paymentType ?? "cash",
    PAYMENT_TYPES,
    "Payment type"
  );

  const hmoProvider = optionalString(input.hmoProvider, "HMO provider", 120);
  const hmoNo = optionalString(input.hmoNo, "HMO number", 40);
  const philhealthPin = optionalString(
    input.philhealthPin,
    "PhilHealth PIN",
    40
  );

  if (!isEmergency && paymentType === "hmo" && !hmoNo) {
    throw new Error("HMO number is required when paying through an HMO.");
  }

  if (!isEmergency && paymentType === "philhealth" && !philhealthPin) {
    throw new Error(
      "PhilHealth PIN is required when paying through PhilHealth."
    );
  }

  const employerName = isEmergency
    ? optionalString(input.employerName, "Employer name", 120)
    : undefined;
  const roomPreference = isEmergency
    ? optionalEnum<RoomPreference>(
        input.roomPreference,
        ROOM_PREFERENCES,
        "Room preference"
      )
    : undefined;

  const emergencyContactName = isEmergency
    ? optionalString(input.emergencyContactName, "Emergency contact name", 120)
    : requiredString(
        input.emergencyContactName,
        "Emergency contact name",
        120
      );
  const emergencyContactRelationship = isEmergency
    ? optionalString(
        input.emergencyContactRelationship,
        "Emergency contact relationship",
        60
      )
    : requiredString(
        input.emergencyContactRelationship,
        "Emergency contact relationship",
        60
      );
  const emergencyContactNumber = parsePhone(
    input.emergencyContactNumber,
    "Emergency contact number"
  );

  if (!isEmergency && !emergencyContactNumber) {
    throw new Error("Emergency contact number is required.");
  }

  const guardianFullName = optionalString(
    input.guardianFullName,
    "Guardian / informant full name",
    120
  );
  const guardianRelationship = optionalEnum<GuardianRelationship>(
    input.guardianRelationship,
    GUARDIAN_RELATIONSHIPS,
    "Guardian / informant relationship"
  );
  const guardianContactNumber = parsePhone(
    input.guardianContactNumber,
    "Guardian / informant mobile number"
  );
  const guardianIdType = optionalString(
    input.guardianIdType,
    "Valid ID type",
    80
  );

  if (respondentRole === "guardian") {
    if (!guardianFullName) throw new Error("Guardian full name is required.");
    if (!guardianRelationship) {
      throw new Error("Guardian relationship is required.");
    }
    if (!guardianContactNumber) {
      throw new Error("Guardian mobile number is required.");
    }
  }

  const signatureData = parseSignature(input.signatureData);

  if (!isEmergency && !signatureData) {
    throw new Error("Please add your signature before submitting.");
  }

  const consentGiven = parseBoolean(input.consentGiven) === true;

  if (!consentGiven) {
    throw new Error("Please accept the data privacy consent.");
  }

  return {
    respondentRole,
    visitPurpose,
    fullName,
    identityUnknown,
    dob,
    age,
    sex,
    civilStatus,
    address,
    contactNumber,
    chiefComplaint,
    allergies,
    hasRequestSlip,
    priorityLane,
    paymentType,
    hmoProvider,
    hmoNo,
    philhealthPin,
    employerName,
    roomPreference,
    emergencyContactName,
    emergencyContactRelationship,
    emergencyContactNumber,
    guardianFullName,
    guardianRelationship,
    guardianContactNumber,
    guardianIdType,
    signatureData,
    consentGiven,
  };
}

export function parsePatientPatch(body: Record<string, unknown>): {
  disposition?: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED";
  details?: Partial<
    Pick<
      Patient,
      | "queueNumber"
      | "assignedRoom"
      | "assignedDoctor"
      | "estimatedWaitMinutes"
      | "status"
    >
  >;
} {
  const input = body ?? {};
  const patch: {
    disposition?: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "ARCHIVED";
    details?: Partial<
      Pick<
        Patient,
        | "queueNumber"
        | "assignedRoom"
        | "assignedDoctor"
        | "estimatedWaitMinutes"
        | "status"
      >
    >;
  } = {};

  if (input.disposition) {
    patch.disposition = input.disposition as
      | "COMPLETED"
      | "CANCELLED"
      | "NO_SHOW"
      | "ARCHIVED";
  }

  if (input.details) {
    patch.details = input.details as Partial<
      Pick<
        Patient,
        | "queueNumber"
        | "assignedRoom"
        | "assignedDoctor"
        | "estimatedWaitMinutes"
        | "status"
      >
    >;
  }

  return patch;
}

export function parseUuid(
  rawId: string | null | undefined,
  entity: string
): string {
  if (!rawId) throw new Error(`${entity} ID is required`);
  if (rawId === "undefined" || rawId === "null")
    throw new Error(`Invalid ${entity} ID`);
  return rawId;
}

export function parseDoctorName(value: unknown): string {
  return value ? String(value).trim() : "";
}

export function parseRoom(value: unknown): string {
  return value ? String(value).trim() : "";
}
