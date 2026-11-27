import { getAdminSession } from "@/lib/auth";
import { json } from "@/lib/errors";

export async function GET() {
  // Kept outside try/catch so the Cache Components prerender signal from
  // `cookies()` reaches Next.js (see lib/api-route.ts).
  const session = await getAdminSession();

  if (!session) {
    return json({ error: "Not signed in." }, 401);
  }

  return json(session);
}
