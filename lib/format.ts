export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function formatDate(
  value: string | Date | null | undefined,
  timeZone = "Asia/Manila"
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTime(
  value: string | Date | null | undefined,
  timeZone = "Asia/Manila"
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  timeZone = "Asia/Manila"
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(
  value: string | Date | null | undefined,
  now: Date = new Date()
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, size] of ranges) {
    if (Math.abs(seconds) >= size || unit === "second") {
      return formatter.format(Math.round(seconds / size), unit);
    }
  }

  return "just now";
}

export function todayInTimeZone(timeZone = "Asia/Manila"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
}

export function displayPatientName(
  patient: { full_name: string; identity_unknown?: boolean } | null | undefined
): string {
  if (!patient) return "Unknown patient";
  if (patient.identity_unknown) return "Unknown / Unconscious";

  return patient.full_name || "Unnamed patient";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return "?";

  return `${parts[0]?.charAt(0) ?? ""}${
    parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : ""
  }`.toUpperCase();
}

export function waitMinutes(
  from: string | null | undefined,
  to: string | null | undefined = new Date().toISOString()
): number {
  if (!from) return 0;

  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatWait(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}
