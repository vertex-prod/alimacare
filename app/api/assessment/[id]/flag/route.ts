import { runStaffAction } from "@/lib/ai/route-helpers";
import { flagAssessment } from "@/lib/ai/StaffActions";

// `id` here is the assessment id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return runStaffAction(request, params, ["ADMIN", "RECEPTION", "DOCTOR"], (id, staff, body) =>
    flagAssessment(id, staff, body.note)
  );
}
