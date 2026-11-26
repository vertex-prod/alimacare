import { NextResponse } from "next/server";
import {
  archivePatient,
  getPatientById,
  updatePatientDetails,
} from "@/lib/patient-repo";
import { errorResponse, readJsonBody } from "@/lib/errors";
import { parsePatientPatch, parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";
import type { PublicPatient } from "@/lib/types";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * The status page is public, so it only receives the fields it displays.
 * Contact details and other PHI stay behind authenticated staff endpoints.
 */
function toPublicPatient(patient: PublicPatient): PublicPatient {
  return {
    patientId: patient.patientId,
    fullName: patient.fullName,
    status: patient.status,
    visitPurpose: patient.visitPurpose,
    department: patient.department,
    priorityLane: patient.priorityLane,
    queueNumber: patient.queueNumber,
    queuePosition: patient.queuePosition,
    assignedDoctor: patient.assignedDoctor,
    assignedRoom: patient.assignedRoom,
    patientsAhead: patient.patientsAhead,
    estimatedWaitMinutes: patient.estimatedWaitMinutes,
    completedTime: patient.completedTime,
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: rawId } = await params;
    const id = parseUuid(rawId, "patient");
    const patient = await getPatientById(id);

    if (!patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    return NextResponse.json(toPublicPatient(patient), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireRoles(["ADMIN", "RECEPTION"]);
    if (!auth.ok) return auth.response;

    const { id: rawId } = await params;
    const id = parseUuid(rawId, "patient");
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const patch = parsePatientPatch(body);

    if (patch.disposition) {
      await archivePatient(id, patch.disposition);
    } else if (patch.details) {
      await updatePatientDetails(id, patch.details);
    }

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

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireRoles(["ADMIN", "RECEPTION"]);
    if (!auth.ok) return auth.response;

    const { id: rawId } = await params;
    const id = parseUuid(rawId, "patient");
    await archivePatient(id, "ARCHIVED");

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
