import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { ApiError } from "./errors";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "./session-token";
import type { AdminSession } from "./types";

// The patients schema has no staff table, so the admin account is configured
// with environment variables: ADMIN_USERNAME, ADMIN_PASSWORD, and
// ADMIN_SESSION_SECRET (used to sign the session cookie).

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

function configuredCredentials(): { username: string; password: string } {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password || !process.env.ADMIN_SESSION_SECRET) {
    throw new ApiError(
      503,
      "Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET in .env.local."
    );
  }

  return { username, password };
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
  const expected = configuredCredentials();

  // Evaluate both comparisons so timing does not reveal which one failed.
  const userOk = safeEqual(username.trim().toLowerCase(), expected.username.toLowerCase());
  const passOk = safeEqual(password, expected.password);

  if (!userOk || !passOk) {
    throw new ApiError(401, "Invalid username or password.");
  }

  const token = createSessionToken(expected.username);
  const store = await cookies();

  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS));

  const session = verifySessionToken(token);

  if (!session) throw new ApiError(500, "Could not start the session.");

  return session;
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(0));
}
