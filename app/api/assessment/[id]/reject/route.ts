import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/errors";
import { jsonError } from "@/lib/ai/route-helpers";
import { isUuid } from "@/lib/ai/uuid";
import { declinePatient, StaffActionError } from "@/lib/ai/StaffActions";

// `id` here is the assessment id. Declining releases the patient back to the
// reception queue, so the response is assembled before that release.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(["DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (!isUuid(id)) return jsonError("Invalid assessment ID.", 400);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const result = await declinePatient(id, auth.staff, body.note);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof StaffActionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Doctor decline failed:", error);
    return jsonError("The assignment could not be declined.", 500);
  }
}
