import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { errorResponse } from "@/lib/errors";
import { parseUuid } from "@/lib/validation";
import { requireRoles } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const auth = await requireRoles(["ADMIN"]);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as { hospitalId?: string };
    if (!body.hospitalId) {
      return NextResponse.json(
        { error: "hospitalId is required." },
        { status: 400 }
      );
    }

    const hospitalId = parseUuid(body.hospitalId, "hospital");

    const { data, error } = await supabase.rpc("rotate_daily_qr_token", {
      p_hospital_id: hospitalId,
    });

    if (error) throw error;

    return NextResponse.json({ token: data });
  } catch (error) {
    return errorResponse(error);
  }
}