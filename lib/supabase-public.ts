import { createClient } from "@supabase/supabase-js";
import type { Db } from "./db/client";

let cached: Db | null = null;

/**
 * Anonymous client (public anon key, no user session). It can only call the
 * two public database functions, register_patient and get_ticket_status;
 * every table is closed to it by Row Level Security.
 */
export function getPublicClient(): Db {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase is not configured.");
  }

  cached = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cached;
}
