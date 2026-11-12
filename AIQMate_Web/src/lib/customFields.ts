// SPEC-039 FR-MD-009. Turning a custom-field form's text inputs into the values the API stores, with
// the same rules the server applies, so most mistakes are caught before a request. The server still
// validates every write (US-005 AC-2, AC-3).

import type { CustomFieldDto, FieldValue } from "@/lib/api/metadata";

/** What a form holds: text for every kind except yes/no. */
export type FieldDraft = Record<string, string | boolean>;

export function toDraft(fields: CustomFieldDto[], values: Record<string, FieldValue>): FieldDraft {
  const draft: FieldDraft = {};
  for (const f of fields) {
    const v = values[f.key];
    if (f.kind === "BOOLEAN") draft[f.key] = v === true;
    else draft[f.key] = v === undefined || v === null ? "" : String(v);
  }
  return draft;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isRealDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export const MAX_TEXT_LENGTH = 500;

export interface PayloadResult {
  values: Record<string, FieldValue | null>;
  /** Field key to a sentence saying what is wrong. Empty when the payload may be sent. */
  errors: Record<string, string>;
}

/** Empty clears (null), numbers travel as numbers, yes/no as booleans. */
export function toPayload(fields: CustomFieldDto[], draft: FieldDraft): PayloadResult {
  const values: Record<string, FieldValue | null> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = draft[f.key];
    if (f.kind === "BOOLEAN") {
      values[f.key] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (f.required) errors[f.key] = "This field is required.";
      values[f.key] = null;
      continue;
    }
    switch (f.kind) {
      case "TEXT":
        if (text.length > MAX_TEXT_LENGTH) errors[f.key] = `Use ${MAX_TEXT_LENGTH} characters or fewer.`;
        values[f.key] = text;
        break;
      case "NUMBER": {
        const n = Number(text);
        if (!Number.isFinite(n)) errors[f.key] = "Enter a number.";
        values[f.key] = n;
        break;
      }
      case "DATE":
        if (!isRealDate(text)) errors[f.key] = "Enter a real date.";
        values[f.key] = text;
        break;
      case "CHOICE":
        if (!f.options.includes(text)) errors[f.key] = "Select one of the options.";
        values[f.key] = text;
        break;
    }
  }
  return { values, errors };
}

/** A display value for read-only views. */
export function displayValue(field: CustomFieldDto, value: FieldValue | undefined): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (field.kind === "BOOLEAN") return value === true ? "Yes" : "No";
  return String(value);
}

/** FR-MD-008: the key rule, for the Add field dialog. */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;

/** A key from a label: "Allergen class" → "allergen_class". */
export function keyFromLabel(label: string): string {
  const k = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 40);
  return k;
}

/** The options Textarea: one per line, trimmed, blanks and repeats dropped. */
export function parseOptions(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const o = line.trim();
    if (o && !seen.has(o)) {
      seen.add(o);
      out.push(o);
    }
  }
  return out;
}
