import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { jsonError } from "@/lib/ai/route-helpers";
import { loadDoctorSnapshots, setDoctorStatus } from "@/lib/db/DoctorRepository";
import { isUuid } from "@/lib/ai/uuid";

/** Live doctor availability and workload, for the reassign picker. */
export async function GET(request: Request) {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const department = new URL(request.url).searchParams.get("department") ?? undefined;
    const doctors = await loadDoctorSnapshots(auth.staff.db, { department });

    return NextResponse.json(
      { doctors },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Doctor availability failed:", error);
    return jsonError("Could not load doctor availability.", 500);
  }
}

const STATUSES = ["AVAILABLE", "BUSY", "ON_BREAK", "OFF_DUTY", "UNAVAILABLE"] as const;

/** Updates a doctor's live status. Doctors can only change their own. */
export async function POST(request: Request) {
  const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const doctorId = String(body.doctorId ?? "");
    const status = String(body.status ?? "") as (typeof STATUSES)[number];

    if (!isUuid(doctorId)) return jsonError("A valid doctorId is required.", 400);
    if (!STATUSES.includes(status)) return jsonError("Invalid status.", 400);

    if (auth.staff.role === "DOCTOR" && auth.staff.doctorId !== doctorId) {
      return jsonError("Doctors can only update their own status.", 403);
    }

    const [doctor] = await loadDoctorSnapshots(auth.staff.db, { doctorId });

    if (!doctor) return jsonError("Doctor not found.", 404);

    await setDoctorStatus(auth.staff.db, doctorId, status);

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Doctor status update failed:", error);
    return jsonError("Could not update doctor status.", 500);
  }
}
