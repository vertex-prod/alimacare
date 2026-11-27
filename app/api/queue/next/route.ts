import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as {
      departmentId?: string;
      hospitalId?: string;
    };

    if (!body.departmentId) {
      return NextResponse.json(
        { error: "departmentId is required." },
        { status: 400 }
      );
    }

    const departmentId = parseUuid(body.departmentId, "department");
    const hospitalId = body.hospitalId
      ? parseUuid(body.hospitalId, "hospital")
      : null;

    const { data, error } = await auth.staff.db.rpc("get_next_patient", {
      p_department_id: departmentId,
      p_hospital_id: hospitalId,
    });

    if (error) throw error;

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}