import { withAdmin } from "@/lib/api-route";
import { json } from "@/lib/errors";
import { STATUSES } from "@/lib/labels";
import { listPatients } from "@/lib/patients";
import type { PatientsResponse, VisitPurpose } from "@/lib/types";
import {
  optionalDate,
  optionalEnum,
  optionalString,
  parseDepartment,
  parseInteger,
} from "@/lib/validation";

const PURPOSES: readonly VisitPurpose[] = [
  "consultation",
  "diagnostic",
  "emergency",
];

export async function GET(request: Request) {
  return withAdmin(request, async () => {
    const params = new URL(request.url).searchParams;

    const page = parseInteger(params.get("page"), "Page", 1, 10_000, 1);
    const pageSize = parseInteger(params.get("pageSize"), "Page size", 5, 100, 25);
    const department = params.get("department")
      ? parseDepartment(params.get("department"))
      : null;

    const { patients, total } = await listPatients({
      q: optionalString(params.get("q"), "Search", 80),
      status: optionalEnum(params.get("status"), STATUSES, "Status"),
      department,
      purpose: optionalEnum(params.get("purpose"), PURPOSES, "Visit purpose"),
      from: optionalDate(params.get("from"), "From date"),
      to: optionalDate(params.get("to"), "To date"),
      page,
      pageSize,
    });

    const body: PatientsResponse = { patients, total, page, pageSize };

    return json(body);
  });
}
