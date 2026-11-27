export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Request failed with status ${response.status}.`;

    // An expired session on any admin call sends the browser back to login.
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      window.location.pathname !== "/admin/login"
    ) {
      const next = `${window.location.pathname}${window.location.search}`;
      // A full page load is intentional: it drops all client state after the
      // session ends. This helper runs outside React, so no router is available.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`);
    }

    throw new ApiClientError(response.status, message);
  }

  return payload as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  return parseResponse<T>(response);
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseResponse<T>(response);
}
