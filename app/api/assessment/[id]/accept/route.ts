import { runStaffAction } from "@/lib/ai/route-helpers";
import { acceptPatient } from "@/lib/ai/StaffActions";

// `id` here is the assessment id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return runStaffAction(request, params, ["DOCTOR"], (id, staff) =>
    acceptPatient(id, staff)
  );
}
