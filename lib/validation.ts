import { ApiError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function requiredString(
  value: unknown,
  label: string,
  maxLength: number
): string {
  const text = String(value ?? "").trim();

  if (!text) throw new ApiError(400, `${label} is required.`);
  if (text.length > maxLength) {
    throw new ApiError(
      400,
      `${label} must be ${maxLength} characters or fewer.`
    );
  }

  return text;
}

export function optionalString(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  if (!text) return null;
  if (text.length > maxLength) {
    throw new ApiError(
      400,
      `${label} must be ${maxLength} characters or fewer.`
    );
  }

  return text;
}

export function optionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | null {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  if (text.length > maxLength) {
    throw new ApiError(
      400,
      `${label} must be ${maxLength} characters or fewer.`
    );
  }

  return text || null;
}

export function requiredUuid(value: unknown, label: string): string {
  const text = String(value ?? "").trim();

  if (!UUID_PATTERN.test(text)) {
    throw new ApiError(400, `${label} is not a valid id.`);
  }

  return text;
}

export function optionalUuid(value: unknown, label: string): string | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return requiredUuid(value, label);
}

export function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T {
  const text = String(value ?? "").trim() as T;

  if (!allowed.includes(text)) {
    throw new ApiError(
      400,
      `${label} must be one of: ${allowed.join(", ")}.`
    );
  }

  return text;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return parseEnum(value, allowed, label);
}

export function parseInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
  fallback?: number
): number {
  if (
    (value === undefined || value === null || String(value).trim() === "") &&
    fallback !== undefined
  ) {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ApiError(
      400,
      `${label} must be a whole number between ${min} and ${max}.`
    );
  }

  return number;
}

export function optionalInteger(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  return parseInteger(value, label, min, max);
}

export function parseBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = String(value).trim().toLowerCase();

  if (["true", "1", "on", "yes"].includes(text)) return true;
  if (["false", "0", "off", "no", ""].includes(text)) return false;

  return fallback;
}

export function parseStringArray(
  value: unknown,
  label: string,
  maxItems = 50,
  maxLength = 120
): string[] {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    throw new ApiError(400, `${label} must be a list.`);
  }

  const values = value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, maxItems);

  for (const item of values) {
    if (item.length > maxLength) {
      throw new ApiError(
        400,
        `${label} items must be ${maxLength} characters or fewer.`
      );
    }
  }

  return Array.from(new Set(values));
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function hasOwn(
  object: Record<string, unknown>,
  key: string
): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export const UUID_RE = UUID_PATTERN;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function optionalDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const text = String(value).trim();

  if (!DATE_PATTERN.test(text)) {
    throw new ApiError(400, `${label} must use the YYYY-MM-DD format.`);
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ApiError(400, `${label} is not a valid date.`);
  }

  return text;
}

const DEPARTMENT_PATTERN = /^[A-Z]{2,8}$/;

/** Department codes follow the `patients_department_format` constraint. */
export function parseDepartment(value: unknown): string {
  const text = String(value ?? "").trim().toUpperCase();

  if (!DEPARTMENT_PATTERN.test(text)) {
    throw new ApiError(400, "Department must be 2–8 capital letters (e.g. OPD).");
  }

  return text;
}
