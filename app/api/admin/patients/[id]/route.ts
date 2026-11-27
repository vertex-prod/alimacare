import { withAdmin } from "@/lib/api-route";
import { json, readJsonBody } from "@/lib/errors";
import {
  getPatient,
  getPatientEvents,
  updatePatientDetails,
  type PatientDetailsPatch,
} from "@/lib/patients";
import type { PatientDetailResponse, PriorityLane } from "@/lib/types";
import {
  hasOwn,
  optionalInteger,
  optionalString,
  parseDepartment,
  parseEnum,
  requiredUuid,
} from "@/lib/validation";

const PRIORITY_LANES: readonly PriorityLane[] = [
  "regular",
  "senior_citizen",
  "pwd",
  "pregnant",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdmin(request, async () => {
    const id = requiredUuid((await params).id, "Patient");

    const [patient, events] = await Promise.all([
      getPatient(id),
      getPatientEvents(id),
    ]);

    const body: PatientDetailResponse = { patient, events };

    return json(body);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAdmin(
    request,
    async (session) => {
      const id = requiredUuid((await params).id, "Patient");
      const body = await readJsonBody(request);
      const patch: PatientDetailsPatch = {};

      if (hasOwn(body, "assignedDoctor")) {
        patch.assigned_doctor = optionalString(
          body.assignedDoctor,
          "Assigned doctor",
          120
        );
      }
      if (hasOwn(body, "assignedRoom")) {
        patch.assigned_room = optionalString(body.assignedRoom, "Assigned room", 60);
      }
      if (hasOwn(body, "estimatedWaitMinutes")) {
        patch.estimated_wait_minutes = optionalInteger(
          body.estimatedWaitMinutes,
          "Estimated wait",
          0,
          1440
        );
      }
      if (hasOwn(body, "priorityLane")) {
        patch.priority_lane = parseEnum(
          body.priorityLane,
          PRIORITY_LANES,
          "Priority lane"
        );
      }
      if (hasOwn(body, "department")) {
        patch.department = parseDepartment(body.department);
      }

      const reason = optionalString(body.reason, "Reason", 300);
      const patient = await updatePatientDetails(id, patch, session.username, reason);

      return json({ patient });
    },
    { mutation: true }
  );
}
