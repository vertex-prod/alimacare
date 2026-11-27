import { withAdmin } from "@/lib/api-route";
import { json } from "@/lib/errors";
import { getQueue, todayManila } from "@/lib/patients";
import type { QueueResponse } from "@/lib/types";
import { optionalDate } from "@/lib/validation";

export async function GET(request: Request) {
  return withAdmin(request, async () => {
    const { searchParams } = new URL(request.url);
    const date = optionalDate(searchParams.get("date"), "Date") ?? todayManila();

    const body: QueueResponse = { date, patients: await getQueue(date) };

    return json(body);
  });
}
