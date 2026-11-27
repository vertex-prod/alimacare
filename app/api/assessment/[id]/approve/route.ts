import { runStaffAction } from "@/lib/ai/route-helpers";
import { approveAssessment } from "@/lib/ai/StaffActions";

// `id` here is the assessment id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return runStaffAction(request, params, ["ADMIN", "RECEPTION", "DOCTOR"], (id, staff, body) =>
    approveAssessment(id, staff, body.note)
  );
}
