import { after, NextResponse } from "next/server";
import {
  createPatient,
  getPendingPatients,
  getWaitingPatients,
} from "@/lib/patient-repo";
import { errorResponse, readJsonBody } from "@/lib/errors";
import { parseCreatePatientInput } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";
import { runAssessment } from "@/lib/ai/Assessment";

export async function GET(request: Request) {
  // Session reads stay outside `try`; see app/api/admin/dashboard/route.ts.
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const patients =
      status === "waiting"
        ? await getWaitingPatients(auth.staff.db)
        : await getPendingPatients(auth.staff.db);

    return NextResponse.json(patients, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let input: ReturnType<typeof parseCreatePatientInput>;

  try {
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    input = parseCreatePatientInput(body);
  } catch (error) {
    // Invalid form input is a client error, not a server failure.
    return errorResponse(error, 400);
  }

  try {
    const patient = await createPatient({
      ...input,
      patientId: undefined,
      status: "PENDING_RECEPTION",
    });

    // AI assessment is strictly additive: it runs after the response is sent,
    // never throws, and registration succeeds even if it is unavailable.
    after(async () => {
      try {
        await runAssessment(patient.id);
      } catch (error) {
        console.error("Post-registration assessment failed:", error);
      }
    });

    return NextResponse.json(patient, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Keep schema and database details out of the public response.
    console.error("Patient registration failed:", error);
    return errorResponse(new Error("Registration failed. Please try again."));
  }
}
