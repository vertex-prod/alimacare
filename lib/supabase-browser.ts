"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser client for staff sign-in only. It uses the public anon key; the
// service-role key never reaches the browser, and all data goes through the
// authenticated API routes.
export function createStaffBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  return createBrowserClient(url, anonKey);
}
