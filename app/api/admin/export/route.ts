import { withAdmin } from "@/lib/api-route";
import { toCsv } from "@/lib/csv";
import { ApiError } from "@/lib/errors";
import { EXPORT_COLUMNS, exportPatients, todayManila } from "@/lib/patients";
import { optionalDate } from "@/lib/validation";

const MAX_RANGE_DAYS = 366;

export async function GET(request: Request) {
  return withAdmin(request, async () => {
    const params = new URL(request.url).searchParams;
    const today = todayManila();
    const from = optionalDate(params.get("from"), "From date") ?? today;
    const to = optionalDate(params.get("to"), "To date") ?? from;

    if (from > to) {
      throw new ApiError(400, "The start date must be on or before the end date.");
    }

    const days =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000;

    if (days >= MAX_RANGE_DAYS) {
      throw new ApiError(400, "Export at most one year at a time.");
    }

    const rows = await exportPatients(from, to);
    const filename =
      from === to
        ? `alimacare-patients-${from}.csv`
        : `alimacare-patients-${from}_to_${to}.csv`;

    return new Response(toCsv(EXPORT_COLUMNS, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
