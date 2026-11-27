import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Db } from "./db/client";

export type StaffRole = "ADMIN" | "RECEPTION" | "DOCTOR";

export interface StaffContext {
  userId: string;
  fullName: string;
  role: StaffRole;
  doctorId: string | null;
  /** Client bound to THIS staff member's session. Every query made through
   *  it is limited by Row Level Security to what their role may see. */
  db: Db;
}

export type AuthResult =
  | { ok: true; staff: StaffContext }
  | { ok: false; response: Response };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Supabase client bound to the request cookies. It uses the public anon key
 * and is only used to identify who is signed in; all data access still goes
 * through the server-only service-role client in lib/supabase.ts.
 */
export async function createSessionClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a context that cannot set cookies; safe to ignore.
        }
      },
    },
  });
}

/**
 * Verifies the signed-in Supabase user and that they hold one of the allowed
 * staff roles. Never throws: failures resolve to a ready-made 401/403 Response,
 * so callers can `if (!auth.ok) return auth.response;`.
 */
export async function requireRoles(
  allowedRoles: StaffRole[]
): Promise<AuthResult> {
  // Authentication is per-request; never attempt it while prerendering.
  await connection();

  try {
    const session = await createSessionClient();
    // getUser() re-validates the JWT with Supabase; getSession() would not.
    const { data, error } = await session.auth.getUser();

    if (error || !data.user) {
      return { ok: false, response: json({ error: "Authentication required." }, 401) };
    }

    // Read under the user's own session; the policy lets a user see only their
    // own profile row.
    const { data: profile, error: profileError } = await session
      .from("staff_profiles")
      .select("full_name, role, doctor_id, active")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Staff profile lookup failed:", profileError.message);
      return { ok: false, response: json({ error: "Authentication failed." }, 500) };
    }

    if (!profile || !profile.active) {
      return { ok: false, response: json({ error: "Forbidden." }, 403) };
    }

    const role = profile.role as StaffRole;

    if (!allowedRoles.includes(role)) {
      return { ok: false, response: json({ error: "Forbidden." }, 403) };
    }

    return {
      ok: true,
      staff: {
        userId: data.user.id,
        fullName: profile.full_name,
        role,
        doctorId: profile.doctor_id ?? null,
        db: session,
      },
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return { ok: false, response: json({ error: "Authentication failed." }, 500) };
  }
}
