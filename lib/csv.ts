function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = typeof value === "object" ? JSON.stringify(value) : String(value);

  // Prevent spreadsheet formula injection from patient-entered text.
  // Plain numbers and phone numbers such as "+63 912 345 6789" are left as-is.
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?[\d\s().-]+$/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  columns: readonly string[],
  rows: Record<string, unknown>[]
): string {
  const lines = [columns.map(escapeCell).join(",")];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column])).join(","));
  }

  // BOM so Excel opens UTF-8 names (ñ, accents) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
