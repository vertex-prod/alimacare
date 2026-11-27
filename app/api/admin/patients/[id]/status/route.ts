import { withAdmin } from "@/lib/api-route";
import { json, readJsonBody } from "@/lib/errors";
import { STATUSES } from "@/lib/labels";
import { changeStatus } from "@/lib/patients";
import {
  hasOwn,
  optionalString,
  parseEnum,
  requiredUuid,
} from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdmin(
    request,
    async (session) => {
      const id = requiredUuid((await params).id, "Patient");
      const body = await readJsonBody(request);
      const status = parseEnum(body.status, STATUSES, "Status");

      const patient = await changeStatus(id, status, session.username, {
        notes: optionalString(body.notes, "Notes", 300),
        assignedDoctor: hasOwn(body, "assignedDoctor")
          ? optionalString(body.assignedDoctor, "Assigned doctor", 120)
          : undefined,
        assignedRoom: hasOwn(body, "assignedRoom")
          ? optionalString(body.assignedRoom, "Assigned room", 60)
          : undefined,
      });

      return json({ patient });
    },
    { mutation: true }
  );
}
