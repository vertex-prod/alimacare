import type { Db } from "../db/client";
import { getPrivilegedClient } from "../supabase-privileged";
import {
  insertAssessment,
  updateAssessment,
  type AssessmentRow,
  type NewAssessment,
} from "../db/AssessmentRepository";
import {
  getClinicalInput,
  updatePatientAssessmentState,
} from "../db/PatientRepository";
import { recommendDepartment } from "./DepartmentRecommendation";
import { recommendDoctor } from "./DoctorAssignment";
import { classify } from "./MedicalClassification";
import { evaluateRedFlags } from "./SafetyValidation";
import { analyseSymptoms } from "./SymptomAnalysis";
import type { AiAnalysis, ClinicalInput, RuleResult } from "./types";

/** Builds and stores one assessment version from rules and (optionally) AI. */
async function buildAndStore(params: {
  db: Db;
  patientUuid: string;
  input: ClinicalInput;
  rules: RuleResult;
  analysis: AiAnalysis | null;
  model: string | null;
  aiError: string | null;
  aiProblems: string[];
}): Promise<AssessmentRow> {
  const { db, patientUuid, input, rules, analysis, model, aiError, aiProblems } = params;

  const classification = classify(rules, analysis);

  const department = recommendDepartment({
    input,
    level: classification.level,
    aiDepartment: analysis?.department ?? null,
    aiConfidence: analysis?.confidence ?? null,
    symptomText: analysis
      ? [...analysis.primarySymptoms, ...analysis.secondarySymptoms].join(" ")
      : "",
  });

  // Doctor availability is read live from Supabase. A failure here must not
  // lose the assessment: it degrades to "pending assignment".
  let assignment: Awaited<ReturnType<typeof recommendDoctor>>;
  let doctorError: string | null = null;

  try {
    assignment = await recommendDoctor(db, {
      department: department.department,
      level: classification.level,
    });
  } catch (error) {
    doctorError = error instanceof Error ? error.message : "Doctor lookup failed.";
    assignment = {
      doctor: null,
      candidates: [],
      pendingAssignment: true,
      reason: "Doctor availability could not be retrieved. Staff must assign a doctor.",
    };
  }

  const errors = [aiError, ...aiProblems, doctorError].filter(Boolean) as string[];
  const failed = analysis === null;

  const row: NewAssessment = {
    status: failed ? "failed" : "completed",
    analysis_source: analysis ? classification.source : "rules",
    primary_symptoms: analysis?.primarySymptoms ?? [],
    secondary_symptoms: analysis?.secondarySymptoms ?? [],
    relevant_history: analysis?.relevantHistory ?? [],
    potential_concerns: analysis?.potentialConcerns ?? [],
    warning_signs: analysis?.warningSigns ?? rules.flags.map((f) => f.label),
    recommended_action: analysis?.recommendedNextAction ?? classification.action,
    confidence: analysis?.confidence ?? null,
    missing_info: analysis?.missingInformation ?? [],
    triage_level: classification.level,
    rule_floor_level: rules.floorLevel,
    classification_reason: classification.reason,
    rule_flags: rules.flags,
    recommended_department: department.department,
    department_reason: department.reason,
    recommended_doctor_id: assignment.doctor?.id ?? null,
    doctor_availability_snapshot: {
      reason: assignment.reason,
      candidates: assignment.candidates,
      checkedAt: new Date().toISOString(),
    },
    pending_assignment: assignment.pendingAssignment,
    needs_human_review: classification.needsHumanReview || failed,
    escalated: rules.escalate || classification.level <= 2,
    model,
    error_detail: errors.length > 0 ? errors.join(" | ").slice(0, 1000) : null,
  };

  const stored = await insertAssessment(db, patientUuid, row);

  await updatePatientAssessmentState(db, patientUuid, {
    aiAssessmentStatus: failed
      ? "failed"
      : row.needs_human_review
        ? "needs_review"
        : "completed",
    // Provisional level so the queue can prioritise before staff validation.
    triageLevel: classification.level,
    clinicalDepartment: department.department,
  });

  return stored;
}

export interface RunResult {
  ok: boolean;
  assessmentId: string | null;
  error?: string;
}

/**
 * Runs the full assessment for a patient. Never throws.
 *
 * Order: deterministic safety rules first. When they detect a Level 1-2 case a
 * rules-only assessment is stored (and therefore visible to staff as an alert)
 * BEFORE the AI is called, so escalation never waits on the AI. The AI result,
 * when it arrives and validates, is stored as a newer version.
 */
export async function runAssessment(patientUuid: string): Promise<RunResult> {
  try {
    // The assessment runs with no signed-in user, so it is the one place that
    // uses the privileged client. Created lazily: if the key is missing only
    // the AI assessment is affected, never registration.
    const db = getPrivilegedClient();
    const input = await getClinicalInput(db, patientUuid);

    if (!input) return { ok: false, assessmentId: null, error: "Patient not found." };

    await updatePatientAssessmentState(db, patientUuid, { aiAssessmentStatus: "pending" });

    const rules = evaluateRedFlags(input);

    let provisional: AssessmentRow | null = null;

    if (rules.escalate) {
      provisional = await buildAndStore({
        db,
        patientUuid,
        input,
        rules,
        analysis: null,
        model: null,
        aiError: "AI analysis pending; escalated by safety rules.",
        aiProblems: [],
      });
    }

    const ai = await analyseSymptoms(input);

    if (provisional && !ai.analysis) {
      // Keep the rules-only version as the record; just note why.
      await updateAssessment(db, provisional.id, {
        error_detail: (ai.error ?? "AI analysis unavailable.").slice(0, 1000),
        model: ai.model,
      });
      await updatePatientAssessmentState(db, patientUuid, {
        aiAssessmentStatus: "failed",
      });

      return { ok: true, assessmentId: provisional.id };
    }

    const stored = await buildAndStore({
      db,
      patientUuid,
      input,
      rules,
      analysis: ai.analysis,
      model: ai.model,
      aiError: ai.error,
      aiProblems: ai.problems,
    });

    return { ok: true, assessmentId: stored.id };
  } catch (error) {
    console.error("Assessment failed:", error);

    try {
      await updatePatientAssessmentState(getPrivilegedClient(), patientUuid, {
        aiAssessmentStatus: "failed",
      });
    } catch {
      // Nothing more can be done; registration is unaffected.
    }

    return {
      ok: false,
      assessmentId: null,
      error: error instanceof Error ? error.message : "Assessment failed.",
    };
  }
}
