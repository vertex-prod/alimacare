import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Db } from "./db/client";

let cached: Db | null = null;

/**
 * The ONLY place the service-role key is read. The service role bypasses Row
 * Level Security, so it is deliberately limited to the AI assessment runner
 * (lib/ai/Assessment.ts), which has no signed-in user. Do not import this from
 * anything else; use the staff session client (lib/api-auth.ts) instead.
 *
 * The client is created lazily so that a missing key degrades only the AI
 * assessment; patient registration does not depend on it.
 */
export function getPrivilegedClient(): Db {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("AI assessment worker credentials are not configured.");
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
