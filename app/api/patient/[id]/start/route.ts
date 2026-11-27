import { NextResponse } from "next/server";
import { getPatientById, startConsultation } from "@/lib/patient-repo";
import { errorResponse } from "@/lib/errors";
import { parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRoles(["ADMIN", "DOCTOR"]);
    if (!auth.ok) return auth.response;

    const { id: rawId } = await params;
    const id = parseUuid(rawId, "patient");

    const existing = await getPatientById(id);
    if (!existing) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    await startConsultation(auth.staff.db, id);

    const patient = await getPatientById(id);
    if (!patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    return NextResponse.json(patient, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
