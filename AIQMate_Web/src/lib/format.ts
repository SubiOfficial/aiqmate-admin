// SPEC-036. Display helpers. No em dash in anything shown (CLAUDE.md 5h).

/** IN_PROGRESS → "In progress", SUBMITTED_FOR_REVIEW → "Submitted for review". */
export function humanizeEnum(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase().trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const numberFmt = new Intl.NumberFormat("en-US");
export function formatCount(n: number): string {
  return numberFmt.format(n);
}

/** A moment (createdAt, completedAt) in the viewer's own zone: "3 Nov 2026, 10:42". */
export function formatMoment(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(locale ?? "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export type StatusTone = "ok" | "warn" | "bad" | "info" | "muted";

export function activityTone(status: string): StatusTone {
  switch (status) {
    case "COMPLETE":
      return "ok";
    case "IN_PROGRESS":
    case "SUBMITTED_FOR_REVIEW":
      return "info";
    case "REDO_REQUIRED":
      return "warn";
    case "CANCELLED":
      return "muted";
    default:
      return "muted";
  }
}

/** A calendar day (trial end, last activity) in the viewer's own zone: "3 Nov 2026". */
export function formatDay(iso: string | null | undefined, locale?: string): string {
  if (!iso) return "None";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(locale ?? "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** A "yyyy-mm" month key as "Jun 2026" (UTC, the month the API counted in). */
export function formatMonth(key: string, locale?: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return new Intl.DateTimeFormat(locale ?? "en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export function formatUsd(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n;
  return v === null || v === undefined || Number.isNaN(v) ? "Not set" : usdFmt.format(v);
}
