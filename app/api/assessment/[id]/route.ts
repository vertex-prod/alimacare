import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { runAssessment } from "@/lib/ai/Assessment";
import { jsonError } from "@/lib/ai/route-helpers";
import { isUuid } from "@/lib/ai/uuid";
import {
  getAuditLog,
  getLatestAssessmentForPatient,
} from "@/lib/db/AssessmentRepository";
import { patientExists } from "@/lib/db/PatientRepository";

// Here `id` is a PATIENT key (internal UUID or the readable AC-... reference).
// The action routes beneath this segment use the ASSESSMENT id instead.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const assessment = await getLatestAssessmentForPatient(auth.staff.db, id);

    if (!assessment) return jsonError("No assessment found for this patient.", 404);

    const audit = await getAuditLog(auth.staff.db, [assessment.id]);

    return NextResponse.json(
      { assessment, audit },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Assessment read failed:", error);
    return jsonError("Could not load the assessment.", 500);
  }
}

/** Re-runs the assessment (creates a new version). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(["ADMIN", "RECEPTION"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    if (!isUuid(id)) return jsonError("Invalid patient ID.", 400);
    if (!(await patientExists(auth.staff.db, id))) return jsonError("Patient not found.", 404);

    const result = await runAssessment(id);

    if (!result.ok) return jsonError("The assessment could not be completed.", 502);

    const assessment = await getLatestAssessmentForPatient(auth.staff.db, id);

    return NextResponse.json(
      { assessment },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Assessment run failed:", error);
    return jsonError("The assessment could not be completed.", 500);
  }
}
