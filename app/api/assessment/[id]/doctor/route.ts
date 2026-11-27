import { runStaffAction } from "@/lib/ai/route-helpers";
import { reassignDoctor, StaffActionError } from "@/lib/ai/StaffActions";
import { isUuid } from "@/lib/ai/uuid";

// `id` here is the assessment id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return runStaffAction(request, params, ["ADMIN", "RECEPTION"], (id, staff, body) => {
    const doctorId = String(body.doctorId ?? "");

    if (!isUuid(doctorId)) throw new StaffActionError("A valid doctorId is required.");

    return reassignDoctor(id, staff, doctorId, {
      override: body.override === true,
      note: body.note,
    });
  });
}

