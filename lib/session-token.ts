import { createHmac, timingSafeEqual } from "node:crypto";

import type { AdminSession } from "./types";

// Shared by lib/auth.ts (route handlers) and proxy.ts, so it must not import
// next/headers or anything server-only.

export const SESSION_COOKIE = "alima_admin_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  username: string,
  now = Date.now()
): string {
  const secret = getSecret();

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be set to at least 32 characters in .env.local."
    );
  }

  const session: AdminSession = {
    username,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  now = Date.now()
): AdminSession | null {
  const secret = getSecret();

  if (!token || !secret) return null;

  const [payload, signature, extra] = token.split(".");

  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as Partial<AdminSession>;

    if (
      typeof session.username !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= now
    ) {
      return null;
    }

    return { username: session.username, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}
