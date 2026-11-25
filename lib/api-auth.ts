"use server";

export async function requireRoles(
  allowedRoles: string[]
): Promise<{ ok: boolean; response?: Response }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "" }),
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok || payload.error) {
      throw new Error(payload.error ?? "Authentication required");
    }

    const roles: string[] = Array.isArray(payload.roles) ? payload.roles : [];
    const ok = allowedRoles.some((role) => roles.includes(role));

    if (!ok) {
      return { ok: false, response: new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 }) };
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}