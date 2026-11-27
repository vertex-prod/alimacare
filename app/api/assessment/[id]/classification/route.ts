import { runStaffAction } from "@/lib/ai/route-helpers";
import { changeClassification } from "@/lib/ai/StaffActions";

// `id` here is the assessment id.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return runStaffAction(request, params, ["ADMIN", "RECEPTION"], (id, staff, body) =>
    changeClassification(id, staff, body.level, body.note)
  );
}
