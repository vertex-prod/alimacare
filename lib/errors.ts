export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON request body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Request body must be a JSON object.");
  }

  return body as Record<string, unknown>;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json({ error: error.message }, error.status);
  }

  if (isSupabaseError(error)) {
    const status =
      error.code === "23505"
        ? 409
        : error.code === "23503"
          ? 409
          : error.code === "23514" || error.code === "22P02"
            ? 400
            : 500;

    if (status === 409) {
      return json(
        {
          error:
            error.code === "23503"
              ? "This record is referenced by other data and cannot be deleted."
              : "That value is already in use. Choose a different one.",
        },
        status
      );
    }

    if (status === 400) {
      return json({ error: error.message }, status);
    }
  }

  console.error("Admin API error:", error);

  const message =
    error instanceof Error ? error.message : "An unknown error occurred.";

  return json(
    {
      error:
        process.env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : message,
    },
    500
  );
}

function isSupabaseError(
  error: unknown
): error is { code?: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

/**
 * Same-site check for state-changing requests. The session cookies are
 * SameSite=Lax, and JSON requests trigger a preflight cross-origin, but this
 * adds a cheap second line of defence.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");

  if (!origin) return;

  const host = request.headers.get("host");

  if (!host) {
    throw new ApiError(403, "Missing request host.");
  }

  let originHost: string;

  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Invalid request origin.");
  }

  if (originHost !== host) {
    throw new ApiError(403, "Cross-origin request blocked.");
  }
}
