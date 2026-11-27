import { loginAdmin } from "@/lib/auth";
import {
  ApiError,
  assertSameOrigin,
  errorResponse,
  json,
  readJsonBody,
} from "@/lib/errors";
import { requiredString } from "@/lib/validation";

// Basic in-memory throttle: 10 failed attempts per IP per 15 minutes. It resets
// when the server restarts; put a shared store in front for multi-instance
// deployments.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function checkThrottle(key: string): void {
  const entry = failures.get(key);

  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILURES) {
    throw new ApiError(
      429,
      "Too many failed attempts. Please wait a few minutes and try again."
    );
  }
}

function recordFailure(key: string): void {
  const now = Date.now();
  const entry = failures.get(key);

  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }

  if (failures.size > 5_000) {
    const oldest = failures.keys().next().value;
    if (oldest) failures.delete(oldest);
  }
}

export async function POST(request: Request) {
  const key = clientKey(request);

  try {
    assertSameOrigin(request);
    checkThrottle(key);

    const body = await readJsonBody(request);
    const username = requiredString(body.username, "Username", 120);
    const password = requiredString(body.password, "Password", 200);

    try {
      const session = await loginAdmin(username, password);
      failures.delete(key);

      return json({ username: session.username, expiresAt: session.expiresAt });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) recordFailure(key);
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
