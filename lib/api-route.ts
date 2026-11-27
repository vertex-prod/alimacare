import { getAdminSession } from "./auth";
import { ApiError, assertSameOrigin, errorResponse } from "./errors";
import type { AdminSession } from "./types";

interface AdminRouteOptions {
  mutation?: boolean;
}

/**
 * Wrap an admin-only route handler with session checks, same-origin checks for
 * mutations, and consistent JSON error responses.
 */
export async function withAdmin(
  request: Request,
  handler: (session: AdminSession) => Promise<Response>,
  options: AdminRouteOptions = {}
): Promise<Response> {
  // Read the session outside `try`: with Cache Components, `cookies()` rejects
  // during the build-time prerender attempt to mark the route dynamic, and
  // that signal must reach Next.js instead of being turned into a 500.
  const session = await getAdminSession();

  try {
    if (options.mutation) assertSameOrigin(request);

    if (!session) {
      throw new ApiError(401, "Your session has expired. Please log in again.");
    }

    return await handler(session);
  } catch (error) {
    return errorResponse(error);
  }
}
