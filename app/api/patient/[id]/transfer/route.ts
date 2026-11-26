import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { errorResponse } from "@/lib/errors";
import { parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRoles(["ADMIN", "RECEPTION", "DOCTOR"]);
    if (!auth.ok) return auth.response;

    const { id: rawId } = await params;
    const patientId = parseUuid(rawId, "patient");

    const body = (await request.json()) as {
      toDepartmentId?: string;
      toCounterId?: string;
      reason?: string;
    };

    if (!body.toDepartmentId) {
      return NextResponse.json(
        { error: "toDepartmentId is required." },
        { status: 400 }
      );
    }

    const toDepartmentId = parseUuid(body.toDepartmentId, "department");
    const toCounterId = body.toCounterId
      ? parseUuid(body.toCounterId, "counter")
      : null;

    // Find the patient's current ticket
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, ticket_id")
      .eq("id", patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient not found." }, { status: 404 });
    }

    if (!patient.ticket_id) {
      return NextResponse.json(
        { error: "Patient has no active ticket to transfer." },
        { status: 400 }
      );
    }

    const { data: transferred, error: transferError } = await supabase.rpc(
      "transfer_ticket",
      {
        p_ticket_id: patient.ticket_id,
        p_to_department_id: toDepartmentId,
        p_to_counter_id: toCounterId,
        p_reason: body.reason ?? null,
        p_staff_id: null,
      }
    );

    if (transferError) throw transferError;

    return NextResponse.json(transferred, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}