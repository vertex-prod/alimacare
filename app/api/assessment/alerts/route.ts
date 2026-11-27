import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { jsonError } from "@/lib/ai/route-helpers";
import { listUnacknowledgedAlerts } from "@/lib/db/AssessmentRepository";

/** Level 1-2 cases no staff member has acknowledged yet. Polled by the dashboard. */
export async function GET() {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const alerts = await listUnacknowledgedAlerts(auth.staff.db);

    return NextResponse.json(
      {
        alerts: alerts.map((a) => ({
          assessmentId: a.id,
          patientId: a.patient.patientId,
          fullName: a.patient.fullName,
          level: a.effective.level,
          label: a.effective.label,
          chiefComplaint: a.patient.chiefComplaint,
          warningSigns: a.warningSigns,
          createdAt: a.createdAt,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Alert listing failed:", error);
    return jsonError("Could not load alerts.", 500);
  }
}
