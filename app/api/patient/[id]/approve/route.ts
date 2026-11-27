import { NextResponse } from "next/server";
import { approvePatient, getPatientById } from "@/lib/patient-repo";
import { errorResponse, readJsonBody } from "@/lib/errors";
import { parseDoctorName, parseRoom, parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRoles(["ADMIN", "RECEPTION"]);
    if (!auth.ok) return auth.response;

    const { id: rawId } = await params;
    const id = parseUuid(rawId, "patient");
    const body = (await readJsonBody(request)) as Record<string, unknown>;

    const assignedDoctor = parseDoctorName(body?.assignedDoctor);
    const assignedRoom = parseRoom(body?.assignedRoom);

    await approvePatient(auth.staff.db, id, assignedDoctor, assignedRoom);

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
