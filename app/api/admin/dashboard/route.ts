import { withAdmin } from "@/lib/api-route";
import { json } from "@/lib/errors";
import { getDashboard } from "@/lib/patients";

export async function GET(request: Request) {
  return withAdmin(request, async () => json(await getDashboard()));
}
