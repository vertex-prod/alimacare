import { NextResponse } from "next/server";
import {
  createPatient,
  getPendingPatients,
  getWaitingPatients,
} from "@/lib/patient-repo";
import { errorResponse, readJsonBody } from "@/lib/errors";
import { parseCreatePatientInput } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function GET(request: Request) {
  // Session reads stay outside `try`; see app/api/admin/dashboard/route.ts.
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const patients =
      status === "waiting" ? await getWaitingPatients() : await getPendingPatients();

    return NextResponse.json(patients, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const input = parseCreatePatientInput(body);
    const patient = await createPatient({
      ...input,
      patientId: undefined,
      status: "PENDING_RECEPTION",
    });

    return NextResponse.json(patient, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
