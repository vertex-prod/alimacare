export type TriageLevel = 1 | 2 | 3 | 4 | 5;

export const TRIAGE_LABELS: Record<TriageLevel, string> = {
  1: "LEVEL 1 – CRITICAL",
  2: "LEVEL 2 – EMERGENCY",
  3: "LEVEL 3 – URGENT",
  4: "LEVEL 4 – LESS URGENT",
  5: "LEVEL 5 – NON-URGENT",
};

export const TRIAGE_ACTIONS: Record<TriageLevel, string> = {
  1: "Immediately alert medical personnel and direct the patient to emergency assessment. Bypass ordinary waiting procedures.",
  2: "Prioritize immediate staff assessment.",
  3: "Assign an appropriately prioritized medical queue.",
  4: "Assign to the appropriate consultation queue.",
  5: "Assign to the regular appointment or consultation queue.",
};

export const DEPARTMENTS = [
  "Emergency Department",
  "Internal Medicine",
  "Cardiology",
  "Dermatology",
  "Orthopedics",
  "Ophthalmology",
  "ENT",
  "Pediatrics",
  "Obstetrics and Gynecology",
  "Gastroenterology",
  "Neurology",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type Confidence = "low" | "medium" | "high";

/** Patient facts that may be analysed. Deliberately excludes name, address,
 *  contact numbers and payment details so they never leave the server. */
export interface ClinicalInput {
  visitPurpose: "consultation" | "diagnostic" | "emergency";
  age: number;
  sex: string;
  priorityLane: string;
  chiefComplaint: string;
  symptomDuration?: string;
  symptomSeverity?: number;
  medicalHistory?: string;
  existingConditions?: string;
  currentMedications?: string;
  allergies?: string;
}

export interface RuleFlag {
  id: string;
  label: string;
  level: TriageLevel;
  matched?: string;
}

export interface RuleResult {
  /** Most urgent level demanded by deterministic rules, or null if none fired. */
  floorLevel: TriageLevel | null;
  flags: RuleFlag[];
  /** True when the case is Level 1 or 2 and staff must be alerted immediately. */
  escalate: boolean;
}

/** Validated output of the language model. */
export interface AiAnalysis {
  primarySymptoms: string[];
  secondarySymptoms: string[];
  relevantHistory: string[];
  potentialConcerns: string[];
  warningSigns: string[];
  recommendedNextAction: string;
  confidence: Confidence;
  missingInformation: string[];
  triageLevel: TriageLevel;
  classificationReason: string;
  department: Department | null;
}
