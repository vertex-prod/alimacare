export function errorResponse(
  error: unknown,
  status: number = 500
): Response {
  const message =
    error instanceof Error ? error.message : "An unknown error occurred";

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}