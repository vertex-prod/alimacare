import { NextResponse } from "next/server";
import { requireRoles, type StaffContext, type StaffRole } from "../api-auth";
import { readJsonBody } from "../errors";
import { isUuid } from "./uuid";
import type { AssessmentView } from "../db/AssessmentRepository";
import { getAuditLog } from "../db/AssessmentRepository";
import { StaffActionError } from "./StaffActions";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonError(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/**
 * Shared wrapper for the staff decision endpoints: authenticates, validates the
 * assessment id, parses the body, runs the action and maps failures to
 * client-safe responses.
 */
export async function runStaffAction(
  request: Request,
  params: Promise<{ id: string }>,
  roles: StaffRole[],
  action: (
    assessmentId: string,
    staff: StaffContext,
    body: Record<string, unknown>
  ) => Promise<AssessmentView>
): Promise<Response> {
  const auth = await requireRoles(roles);

  if (!auth.ok) return auth.response;

  try {
    const { id: rawId } = await params;
    if (!isUuid(rawId)) return jsonError("Invalid assessment ID.", 400);
    const id = rawId;
    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const view = await action(id, auth.staff, body ?? {});
    const audit = await getAuditLog(auth.staff.db, [id]);

    return NextResponse.json({ assessment: view, audit }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StaffActionError) {
      return jsonError(error.message, error.status);
    }

    console.error("Staff action failed:", error);

    return jsonError("The action could not be completed.", 500);
  }
}
