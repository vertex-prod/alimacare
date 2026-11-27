const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values: Record<string, string> = {};

  for (const part of getPartsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/** Milliseconds to add to a UTC timestamp to obtain the wall-clock time. */
export function zonedOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUtc - date.getTime();
}

export function zonedDateString(
  date: Date = new Date(),
  timeZone = "Asia/Manila"
): string {
  const parts = zonedParts(date, timeZone);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
}

/** The UTC instant of local midnight for the given instant. */
export function zonedDayStart(
  timeZone: string,
  date: Date = new Date()
): Date {
  const parts = zonedParts(date, timeZone);
  const localMidnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day);

  let offset = zonedOffsetMs(date, timeZone);
  let candidate = new Date(localMidnightUtc - offset);

  offset = zonedOffsetMs(candidate, timeZone);
  candidate = new Date(localMidnightUtc - offset);

  return candidate;
}

/** The UTC instant of the next local midnight. */
export function nextZonedMidnight(
  timeZone: string,
  date: Date = new Date()
): Date {
  const parts = zonedParts(date, timeZone);
  const localMidnightUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + 1
  );

  let offset = zonedOffsetMs(date, timeZone);
  let candidate = new Date(localMidnightUtc - offset);

  offset = zonedOffsetMs(candidate, timeZone);
  candidate = new Date(localMidnightUtc - offset);

  return candidate;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
