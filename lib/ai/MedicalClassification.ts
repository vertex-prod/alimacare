import {
  TRIAGE_ACTIONS,
  TRIAGE_LABELS,
  type AiAnalysis,
  type RuleResult,
  type TriageLevel,
} from "./types";

export interface Classification {
  level: TriageLevel;
  label: string;
  action: string;
  reason: string;
  /** Level proposed by the AI alone (null when the AI produced nothing). */
  aiLevel: TriageLevel | null;
  needsHumanReview: boolean;
  source: "rules" | "ai" | "rules+ai";
}

/** Level used when neither rules nor AI can say anything. Deliberately not a
 *  low-urgency level: unknown means a human must look. */
const UNASSESSED_LEVEL: TriageLevel = 3;

/**
 * Merges the deterministic rule floor with the AI proposal. A lower number is
 * more urgent, so the final level is the minimum of the two: the AI can raise
 * urgency above the rules but can never lower it below them.
 */
export function classify(
  rules: RuleResult,
  analysis: AiAnalysis | null
): Classification {
  const aiLevel = analysis?.triageLevel ?? null;
  const floor = rules.floorLevel;

  const reasons: string[] = [];
  let needsHumanReview = false;
  let level: TriageLevel;
  let source: Classification["source"];

  if (floor !== null && aiLevel !== null) {
    level = Math.min(floor, aiLevel) as TriageLevel;
    source = "rules+ai";
  } else if (floor !== null) {
    level = floor;
    source = "rules";
  } else if (aiLevel !== null) {
    level = aiLevel;
    source = "ai";
  } else {
    level = UNASSESSED_LEVEL;
    source = "rules";
    needsHumanReview = true;
    reasons.push(
      "No automated assessment was available and no warning signs were detected. Provisional level assigned; staff must assess this patient."
    );
  }

  if (rules.flags.length > 0) {
    reasons.push(
      "Safety rules detected: " +
        rules.flags.map((f) => f.label).join("; ") +
        "."
    );
  }

  if (analysis) {
    reasons.push(analysis.classificationReason);

    if (floor !== null && aiLevel !== null && aiLevel > floor) {
      reasons.push(
        `The AI suggested level ${aiLevel}, but warning signs raised it to level ${floor}. A level is never lowered below the safety rules.`
      );
      needsHumanReview = true;
    }

    if (analysis.confidence === "low") {
      needsHumanReview = true;
      reasons.push("AI confidence is low; clinical review is required.");
    }
  } else if (floor !== null) {
    needsHumanReview = true;
    reasons.push(
      "The AI analysis was unavailable, so this level comes from safety rules alone."
    );
  }

  if (level <= 2) needsHumanReview = true;

  reasons.push(
    "This is a preliminary classification and not a diagnosis. A qualified healthcare professional must validate or override it."
  );

  return {
    level,
    label: TRIAGE_LABELS[level],
    action: TRIAGE_ACTIONS[level],
    reason: reasons.join(" "),
    aiLevel,
    needsHumanReview,
    source,
  };
}
