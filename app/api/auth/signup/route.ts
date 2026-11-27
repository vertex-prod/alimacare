import { registerAdmin } from "@/lib/auth";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readJsonBody,
} from "@/lib/errors";
import { requiredString } from "@/lib/validation";

// In-memory throttle: 10 attempts per IP per 15 minutes (resets on restart).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function recordAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_ATTEMPTS) {
      throw new ApiError(
        429,
        "Too many attempts. Please wait a few minutes and try again."
      );
    }
    entry.count += 1;
    return;
  }

  attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });

  if (attempts.size > 5_000) {
    const oldest = attempts.keys().next().value;
    if (oldest) attempts.delete(oldest);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    recordAttempt(clientKey(request));

    const body = await readJsonBody(request);
    const username = requiredString(body.username, "Username", 40);
    const password = requiredString(body.password, "Password", 200);
    const signupCode = requiredString(body.signupCode, "Sign-up code", 200);

    const session = await registerAdmin(username, password, signupCode);

    return json({ username: session.username, expiresAt: session.expiresAt }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
