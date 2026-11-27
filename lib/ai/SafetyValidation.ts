import {
  DEPARTMENTS,
  type AiAnalysis,
  type ClinicalInput,
  type Confidence,
  type Department,
  type RuleFlag,
  type RuleResult,
  type TriageLevel,
} from "./types";

/**
 * Deterministic red-flag engine. It runs BEFORE and independently of the
 * language model, so emergency escalation never waits on (or depends on) AI.
 * The model can only make a case MORE urgent than this floor, never less.
 *
 * Text is lower-cased and stripped of diacritics. Patterns cover English,
 * Filipino/Tagalog and common informal spellings. These rules are a safety net,
 * not a clinical guideline: they must be reviewed by the hospital's clinicians.
 */

interface Rule {
  id: string;
  label: string;
  level: TriageLevel;
  /** OR of AND-groups: the rule fires if every pattern in any group matches. */
  terms: RegExp[][];
}

const CHEST_PAIN =
  /(chest (pain|pressure|tightness|discomfort|hurts?)|pain in (my |the )?chest|heart attack|atake sa puso|(masakit|sumasakit|kirot|sakit|bigat|hapdi)( ang| sa| ng)?( aking| kong)? ?(dibdib|puso)|dibdib ko( ay)? ?(masakit|mabigat|sumasakit)|tight chest|puso ko( ay)? ?(masakit|sumasakit))/g;

const BREATHING =
  /(difficulty breathing|trouble breathing|short(ness)? of breath|hard to breathe|hirap (na )?(sa )?(paghinga|huminga)|nahihirapan( po)?( akong| siyang| syang| sya| ako)? ?(huminga|sa paghinga)|hinihingal|hingal na hingal|nasasakal|gasping|wheez)/g;

const CANNOT_BREATHE =
  /(can'?t breathe|cannot breathe|unable to breathe|not breathing|stopped breathing|hindi (na )?(ako |siya |sya )?(makahinga|humihinga)|di (na )?(ako |siya |sya )?(makahinga|humihinga)|hirap na hirap (huminga|sa paghinga)|choking|nabulunan|nabubulunan)/g;

const RULES: Rule[] = [
  {
    id: "no_breathing_or_pulse",
    label: "Not breathing or no pulse / cardiac arrest",
    level: 1,
    terms: [
      [/(cardiac arrest|no pulse|walang pulso|walang pulse|not breathing|stopped breathing|hindi (na )?humihinga|di (na )?humihinga)/g],
    ],
  },
  {
    id: "unconscious",
    label: "Unconscious or unresponsive",
    level: 1,
    terms: [
      [/(unconscious|unresponsive|not responding|passed out and (not|won'?t)|hindi (na )?(gumigising|tumutugon|nagrerespond)|walang malay|nawalan ng malay|nawalan ng ulirat|walang response)/g],
    ],
  },
  {
    id: "cannot_breathe",
    label: "Severe difficulty breathing",
    level: 1,
    terms: [[CANNOT_BREATHE]],
  },
  {
    id: "chest_pain_with_breathing",
    label: "Chest pain together with difficulty breathing",
    level: 1,
    terms: [[CHEST_PAIN, BREATHING]],
  },
  {
    id: "severe_bleeding",
    label: "Severe or uncontrolled bleeding",
    level: 1,
    terms: [
      [/(severe bleeding|heavy bleeding|profuse bleeding|bleeding (a lot|heavily|badly|won'?t stop|nonstop|non-stop)|uncontrolled bleeding|hemorrhag|haemorrhag|hindi (matigil|tumitigil|humihinto)( ang)? dugo|dugo.{0,20}hindi (tumitigil|matigil|humihinto)|sobrang dami ng dugo|maraming dugo|duguan|bumubulwak ang dugo)/g],
    ],
  },
  {
    id: "penetrating_trauma",
    label: "Gunshot or stab wound",
    level: 1,
    terms: [[/(gunshot|shot in the|stab wound|stabbed|binaril|sinaksak|tama ng bala|saksak)/g]],
  },
  {
    id: "stroke_signs",
    label: "Possible stroke signs",
    level: 1,
    terms: [
      [/(slurred speech|slurring|utal( bigla)?|biglang (utal|bulol)|face droop|facial droop|droopy face|nakabaluktot ang (mukha|bibig)|biglang (namanhid|nanghina)|sudden (numbness|weakness)|weakness on (one|the) (side|left|right)|(one|isang) side.{0,15}(weak|numb|manhid|mahina)|paralyz|paralis|hindi maigalaw ang (kamay|braso|paa|binti|katawan)|stroke)/g],
    ],
  },
  {
    id: "chest_pain",
    label: "Chest pain / possible cardiac event",
    level: 2,
    terms: [[CHEST_PAIN]],
  },
  {
    id: "breathing_difficulty",
    label: "Difficulty breathing",
    level: 2,
    terms: [[BREATHING]],
  },
  {
    id: "severe_allergic_reaction",
    label: "Possible severe allergic reaction",
    level: 2,
    terms: [
      [/(anaphyla|throat (is )?(closing|swelling|swollen)|swollen (tongue|lips|throat|face)|namamaga( ang)? (lalamunan|dila|labi|mukha)|bumabara ang lalamunan|nagsasara ang lalamunan)/g],
      [/(allergic|allergy|allergi|alerhiya|alergi)/g, /(hives|rash|pantal|swelling|namamaga|hirap huminga|difficulty breathing)/g, /(severe|grabe|sobra|spreading|kumakalat|whole body|buong katawan)/g],
    ],
  },
  {
    id: "seizure",
    label: "Seizure or convulsion",
    level: 2,
    terms: [[/(seizure|convuls|kombulsyon|kumombulsyon|nanginginig at (walang malay|hindi)|epilep|nagkaroon ng sumpong|inatake ng epilepsy)/g]],
  },
  {
    id: "fainting",
    label: "Fainting / collapse",
    level: 2,
    terms: [[/(fainted|fainting|collapsed|syncope|nahimatay|natumba bigla|bigla(ng)? (nawalan|nandilim)|nandilim ang paningin)/g]],
  },
  {
    id: "self_harm",
    label: "Possible self-harm or suicidal thoughts",
    level: 2,
    terms: [[/(suicid|kill myself|end my life|want to die|self[- ]harm|magpakamatay|gusto (ko|kong) (nang )?mamatay|ayoko (na )?mabuhay|nagpakamatay|cut my wrist|hiniwa ang pulso)/g]],
  },
  {
    id: "poisoning_overdose",
    label: "Possible poisoning or overdose",
    level: 2,
    terms: [[/(overdose|poison|nalason|nakalunok ng (lason|gamot)|uminom ng (lason|muriatic|bleach|insecticide)|ininom ang (lason|gamot))/g]],
  },
  {
    id: "serious_injury",
    label: "Serious injury",
    level: 2,
    terms: [
      [/(head injury|hit (my|his|her) head|nabagok|nauntog.{0,30}(suka|sumuka|antok|nahilo)|open fracture|bone (is )?sticking out|lumalabas ang buto|nasagasaan|hit by (a )?(car|vehicle|truck|motorcycle)|vehicular|car accident|motorcycle accident|vehicle accident|nahulog (mula|sa) (mataas|bubong|puno|building|gusali)|fell from (a )?(height|roof|tree|building)|severe burn|malubhang paso|third.degree burn)/g],
    ],
  },
  {
    id: "pregnancy_bleeding",
    label: "Bleeding or severe pain during pregnancy",
    level: 2,
    terms: [
      [/(pregnan|buntis|nagdadalang.?tao)/g, /(bleed|dugo|spotting|severe (pain|cramp)|matinding (sakit|kirot)|leaking|pumutok ang panubigan|water broke)/g],
    ],
  },
  {
    id: "fracture",
    label: "Suspected fracture",
    level: 3,
    terms: [[/(fracture|broken (bone|arm|leg|wrist|ankle)|nabali|\bbali\b|baling buto|dislocat)/g]],
  },
  {
    id: "persistent_high_fever",
    label: "Persistent or high fever",
    level: 3,
    terms: [
      [/(high fever|mataas na lagnat|matinding lagnat|fever|lagnat|nilalagnat)/g, /(3|three|tatlong|4|four|apat na|5|five|limang|several|ilang|many|maraming) (days?|araw)|(since|for|simula|mula).{0,12}(last )?(week|linggo)|persistent|paulit.?ulit|hindi (bumababa|nawawala)|39|40|41/g],
    ],
  },
  {
    id: "persistent_vomiting",
    label: "Persistent vomiting or dehydration concern",
    level: 3,
    terms: [
      [/(persistent vomiting|vomiting (all|every|non.?stop|repeatedly)|dehydrat|walang ihi|hindi makainom|can'?t keep (anything|fluids|water) down|paulit.?ulit na (pagsusuka|suka)|(pagsusuka|nagsusuka|suka nang suka|sumusuka).{0,25}(hindi (tumitigil|matigil)|maghapon|buong araw|paulit)|nagtatae.{0,25}(sumusuka|nagsusuka)|(sumusuka|nagsusuka).{0,25}nagtatae)/g],
    ],
  },
  {
    id: "severe_abdominal_pain",
    label: "Significant abdominal pain",
    level: 3,
    terms: [
      [/(abdominal pain|stomach pain|belly pain|sakit ng tiyan|masakit ang tiyan|sumasakit ang tiyan|kirot sa tiyan|sakit sa tiyan)/g, /(severe|matinding|grabe|sobrang|unbearable|hindi (na )?makayanan|moderate|medyo malala|worsening|lumalala|right lower|kanang ibaba)/g],
    ],
  },
];

const NEGATOR_BEFORE =
  /(?:\b(?:no|not|without|denies|denied|never|none|wala(?:ng)?|hindi|di|walang|negative for)\s+(?:\w+\s+)?)$/;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the first match of `pattern` that is not directly negated. */
function findUnnegated(text: string, pattern: RegExp): string | null {
  const re = new RegExp(pattern.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m[0] === "") {
      re.lastIndex++;
      continue;
    }

    const before = text.slice(Math.max(0, m.index - 24), m.index);

    if (!NEGATOR_BEFORE.test(before)) return m[0];
  }

  return null;
}

export function evaluateRedFlags(input: ClinicalInput): RuleResult {
  const text = normalise(
    [
      input.chiefComplaint,
      input.symptomDuration,
      input.medicalHistory,
      input.existingConditions,
    ]
      .filter(Boolean)
      .join(" . ")
  );

  const flags: RuleFlag[] = [];

  for (const rule of RULES) {
    for (const group of rule.terms) {
      const matches = group.map((p) => findUnnegated(text, p));

      if (matches.every((m) => m !== null)) {
        flags.push({
          id: rule.id,
          label: rule.label,
          level: rule.level,
          matched: matches[0] ?? undefined,
        });
        break;
      }
    }
  }

  // Context signals that never depend on the free text.
  if (input.visitPurpose === "emergency") {
    flags.push({
      id: "emergency_intake",
      label: "Patient used the Emergency intake path",
      level: 2,
    });
  }

  const severity = input.symptomSeverity;

  if (severity !== undefined) {
    if (severity >= 9) {
      flags.push({
        id: "severity_extreme",
        label: `Patient rated severity ${severity}/10`,
        level: 2,
      });
    } else if (severity >= 7) {
      flags.push({
        id: "severity_high",
        label: `Patient rated severity ${severity}/10`,
        level: 3,
      });
    }
  }

  if (
    input.age <= 1 &&
    findUnnegated(text, /(fever|lagnat|nilalagnat|mainit ang katawan)/g)
  ) {
    flags.push({
      id: "infant_fever",
      label: "Fever in an infant",
      level: 2,
    });
  }

  let floorLevel: TriageLevel | null = null;

  for (const flag of flags) {
    if (floorLevel === null || flag.level < floorLevel) floorLevel = flag.level;
  }

  return {
    floorLevel,
    flags,
    escalate: floorLevel !== null && floorLevel <= 2,
  };
}

// ---------------------------------------------------------------------------
// Validation of language-model output
// ---------------------------------------------------------------------------

const FORBIDDEN_CLAIMS =
  /(\bprescrib|\btake \d+ ?(mg|ml|tablets?|pills?)\b|\bdosage\b|\bdose of\b|you (have|are suffering from) [a-z ]{3,40}\b(definitely|certainly)|\bdefinitive diagnosis\b|\bconfirmed (diagnosis|case of)\b|\bdiagnosed with\b|\bthe diagnosis is\b|\bmagpa-?inom ka ng\b|\binumin mo ang\b)/i;

const MAX_ITEMS = 10;
const MAX_ITEM_LENGTH = 240;

function cleanList(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const items: string[] = [];

  for (const entry of value.slice(0, MAX_ITEMS)) {
    if (typeof entry !== "string") return null;

    const text = entry.trim().slice(0, MAX_ITEM_LENGTH);

    if (text) items.push(text);
  }

  return items;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim().slice(0, max);

  return text || null;
}

export interface AiValidation {
  analysis: AiAnalysis | null;
  /** Reasons the output was rejected or sanitised. */
  problems: string[];
}

/** Hand-validates untrusted model JSON. Returns null analysis when unusable. */
export function validateAiAnalysis(raw: unknown): AiValidation {
  const problems: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { analysis: null, problems: ["AI output was not a JSON object."] };
  }

  const o = raw as Record<string, unknown>;

  const primary = cleanList(o.primarySymptoms);
  const secondary = cleanList(o.secondarySymptoms);
  const history = cleanList(o.relevantHistory);
  const concerns = cleanList(o.potentialConcerns);
  const warnings = cleanList(o.warningSigns);
  const missing = cleanList(o.missingInformation);

  if (!primary || !secondary || !history || !concerns || !warnings || !missing) {
    return { analysis: null, problems: ["AI output had malformed list fields."] };
  }

  const level = Number(o.triageLevel);

  if (!Number.isInteger(level) || level < 1 || level > 5) {
    return { analysis: null, problems: ["AI output had an invalid triage level."] };
  }

  const reason = cleanText(o.classificationReason, 800);
  const action = cleanText(o.recommendedNextAction, 500);

  if (!reason || !action) {
    return { analysis: null, problems: ["AI output was missing its explanation."] };
  }

  const confidenceRaw = String(o.confidence ?? "").toLowerCase();
  const confidence: Confidence = (["low", "medium", "high"] as const).includes(
    confidenceRaw as Confidence
  )
    ? (confidenceRaw as Confidence)
    : "low";

  if (confidence === "low" && confidenceRaw !== "low") {
    problems.push("AI confidence missing or invalid; treated as low.");
  }

  const department =
    typeof o.department === "string"
      ? (DEPARTMENTS.find(
          (d) => d.toLowerCase() === (o.department as string).trim().toLowerCase()
        ) as Department | undefined) ?? null
      : null;

  const allText = [
    ...primary,
    ...secondary,
    ...history,
    ...concerns,
    ...warnings,
    reason,
    action,
  ];

  if (allText.some((t) => FORBIDDEN_CLAIMS.test(t))) {
    return {
      analysis: null,
      problems: [
        "AI output contained a diagnosis or treatment claim and was discarded.",
      ],
    };
  }

  return {
    analysis: {
      primarySymptoms: primary,
      secondarySymptoms: secondary,
      relevantHistory: history,
      potentialConcerns: concerns,
      warningSigns: warnings,
      recommendedNextAction: action,
      confidence,
      missingInformation: missing,
      triageLevel: level as TriageLevel,
      classificationReason: reason,
      department,
    },
    problems,
  };
}
