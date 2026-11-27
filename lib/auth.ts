import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "./errors";
import { hashPassword, verifyPassword } from "./passwords";
import { getSupabaseAdmin } from "./supabase";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "./session-token";
import type { AdminSession } from "./types";

// Admins can come from two places: the optional ADMIN_USERNAME / ADMIN_PASSWORD
// environment account, and accounts created at /admin/signup (stored in the
// `admin_users` table, see database/admin_users.sql). ADMIN_SESSION_SECRET
// signs the session cookie, and ADMIN_SIGNUP_CODE gates who may sign up.

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Constant-time comparison that does not leak the length of either value. */
function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();

  return timingSafeEqual(left, right);
}

function assertConfigured(): void {
  if (!process.env.ADMIN_SESSION_SECRET) {
    throw new ApiError(
      503,
      "Admin login is not configured. Set ADMIN_SESSION_SECRET in .env.local."
    );
  }
}

async function startSession(username: string): Promise<AdminSession> {
  const token = createSessionToken(username);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));

  const session = verifySessionToken(token);

  if (!session) throw new ApiError(500, "Could not start the session.");

  return session;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();

  if (!session) {
    throw new ApiError(401, "Your session has expired. Please log in again.");
  }

  return session;
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<AdminSession> {
  assertConfigured();

  const name = username.trim();
  const envUser = process.env.ADMIN_USERNAME?.trim();
  const envPass = process.env.ADMIN_PASSWORD;

  // Evaluate every comparison so timing does not reveal which one failed.
  let ok = false;

  if (envUser && envPass) {
    const userOk = safeEqual(name.toLowerCase(), envUser.toLowerCase());
    const passOk = safeEqual(password, envPass);
    ok = userOk && passOk;
  }

  let canonical = envUser ?? name;

  if (!ok) {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_users")
      .select("username, password_hash")
      .ilike("username", name.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();

    // A missing table just means nobody has signed up yet.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      throw error;
    }

    const hash = data?.password_hash ?? "00:00";
    const valid = await verifyPassword(password, hash);

    if (data && valid) {
      ok = true;
      canonical = data.username;
    }
  }

  if (!ok) throw new ApiError(401, "Invalid username or password.");

  return startSession(canonical);
}

export async function registerAdmin(
  username: string,
  password: string,
  signupCode: string
): Promise<AdminSession> {
  assertConfigured();

  const expected = process.env.ADMIN_SIGNUP_CODE;

  if (!expected) {
    throw new ApiError(
      503,
      "Sign up is not enabled. Set ADMIN_SIGNUP_CODE in .env.local."
    );
  }

  if (!safeEqual(signupCode, expected)) {
    throw new ApiError(403, "Invalid sign-up code.");
  }

  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    throw new ApiError(
      400,
      "Username must be 3–40 characters: letters, numbers, dot, dash or underscore."
    );
  }

  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters.");
  }

  const envUser = process.env.ADMIN_USERNAME?.trim();

  if (envUser && envUser.toLowerCase() === username.toLowerCase()) {
    throw new ApiError(409, "That username is already taken.");
  }

  const { error } = await getSupabaseAdmin()
    .from("admin_users")
    .insert({ username, password_hash: await hashPassword(password) });

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(409, "That username is already taken.");
    }

    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new ApiError(
        503,
        "The admin_users table is missing. Run database/admin_users.sql in Supabase."
      );
    }

    throw error;
  }

  return startSession(username);
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(0));
}
