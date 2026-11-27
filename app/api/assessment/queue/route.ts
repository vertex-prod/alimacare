import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { jsonError } from "@/lib/ai/route-helpers";
import { listActiveAssessments } from "@/lib/db/AssessmentRepository";

/** Latest assessment for every active patient, most urgent first. */
export async function GET() {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const assessments = await listActiveAssessments(auth.staff.db);

    return NextResponse.json(
      { assessments },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Assessment queue failed:", error);
    return jsonError("Could not load assessments.", 500);
  }
}
