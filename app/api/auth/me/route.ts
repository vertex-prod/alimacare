import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";

/** Who is signed in? Used by the staff UI to decide which controls to show. */
export async function GET() {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      fullName: auth.staff.fullName,
      role: auth.staff.role,
      doctorId: auth.staff.doctorId,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
