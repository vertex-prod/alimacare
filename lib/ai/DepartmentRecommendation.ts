import type { ClinicalInput, Department, TriageLevel } from "./types";

/** Patients up to this age are routed to Pediatrics (hospital policy, adjust). */
export const PEDIATRIC_MAX_AGE = 17;

export interface DepartmentRecommendation {
  department: Department;
  reason: string;
  /** True when symptoms were unclear and a general first assessment is advised. */
  initialAssessment: boolean;
}

const KEYWORDS: [Department, RegExp][] = [
  [
    "Obstetrics and Gynecology",
    /(pregnan|buntis|prenatal|labor pains?|contraction|menstru|period (pain|late|delayed)|regla|vaginal|pelvic|obgyn|ob-gyn|breastfeed|postpartum|nanganak|panganganak)/i,
  ],
  [
    "Cardiology",
    /(chest (pain|pressure|tightness)|palpitation|heart|puso|dibdib|irregular heartbeat|tibok|blood pressure|high blood|hypertension|mataas ang bp)/i,
  ],
  [
    "Neurology",
    /(seizure|convuls|stroke|numbness|tingling|manhid|dizz|vertigo|hilo|migraine|headache|sakit ng ulo|memory loss|tremor|nanginginig|weakness on one side|slurred)/i,
  ],
  [
    "Orthopedics",
    /(fracture|broken|bali|nabali|sprain|namaga ang (paa|kamay|tuhod)|joint pain|sakit ng (tuhod|balikat|likod|buto|kasukasuan)|back pain|bone|buto|dislocat|knee|shoulder pain|ankle)/i,
  ],
  [
    "Dermatology",
    /(rash|pantal|skin|balat|itch|kati|acne|pimple|eczema|hives|ringworm|an-an|buni|sugat sa balat|wart|kulugo)/i,
  ],
  [
    "Ophthalmology",
    /(\beye\b|eyes|mata\b|blurred vision|malabo ang (mata|paningin)|red eye|namumula ang mata|sore eye|vision|paningin)/i,
  ],
  [
    "ENT",
    /(\bear\b|ears|tenga|sore throat|namamagang lalamunan|masakit ang lalamunan|nose|ilong|sinus|nosebleed|tonsil|hearing|hoarse|paos|runny nose|sipon|barado ang ilong)/i,
  ],
  [
    "Gastroenterology",
    /(abdominal|stomach|tiyan|belly|diarrhea|diarrhoea|nagtatae|pagtatae|constipat|vomit|suka|nausea|nasusuka|heartburn|acid reflux|hyperacidity|ulcer|liver|atay|blood in (stool|vomit)|dugo sa (dumi|suka))/i,
  ],
];

const EMERGENCY_DEPARTMENT: Department = "Emergency Department";

function pickFromText(text: string): Department | null {
  for (const [department, pattern] of KEYWORDS) {
    if (pattern.test(text)) return department;
  }

  return null;
}

/**
 * Recommends a clinical department. Level 1-2 always go to the Emergency
 * Department. Otherwise the AI suggestion is used when valid; unclear cases fall
 * back to a general initial assessment rather than an assumed specialist.
 */
export function recommendDepartment(params: {
  input: ClinicalInput;
  level: TriageLevel;
  aiDepartment: Department | null;
  aiConfidence: "low" | "medium" | "high" | null;
  symptomText: string;
}): DepartmentRecommendation {
  const { input, level, aiDepartment, aiConfidence, symptomText } = params;

  if (level <= 2) {
    return {
      department: EMERGENCY_DEPARTMENT,
      reason: `${level === 1 ? "Critical" : "Emergency"}-level warning signs require emergency assessment.`,
      initialAssessment: false,
    };
  }

  if (input.age <= PEDIATRIC_MAX_AGE) {
    return {
      department: "Pediatrics",
      reason: `Patient is ${input.age} year(s) old; pediatric care is recommended.`,
      initialAssessment: false,
    };
  }

  const combined = `${input.chiefComplaint} ${symptomText}`;
  const fromKeywords = pickFromText(combined);

  if (
    aiDepartment &&
    aiDepartment !== EMERGENCY_DEPARTMENT &&
    aiConfidence !== "low"
  ) {
    return {
      department: aiDepartment,
      reason: `Symptoms are most consistent with ${aiDepartment}.`,
      initialAssessment: aiDepartment === "Internal Medicine",
    };
  }

  if (fromKeywords) {
    return {
      department: fromKeywords,
      reason: `Reported symptoms point to ${fromKeywords}.`,
      initialAssessment: false,
    };
  }

  return {
    department: "Internal Medicine",
    reason:
      "Symptoms are unclear or general, so an initial assessment by Internal Medicine is recommended instead of assigning a specialist.",
    initialAssessment: true,
  };
}
