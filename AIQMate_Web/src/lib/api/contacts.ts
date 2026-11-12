// SPEC-038 FR-TAI-010. A company's points of contact, shared by the Super Admin's tenant page and
// the Org Admin's Company contacts page. Same shape and rules on both routes.

import { ApiError } from "./client";

export const CONTACT_TYPES = ["PRIMARY", "BILLING", "TECHNICAL", "OTHER"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  PRIMARY: "Primary",
  BILLING: "Billing",
  TECHNICAL: "Technical",
  OTHER: "Other",
};

/** FR-TAI-010: at most 3 contacts per organisation. */
export const MAX_CONTACTS = 3;

export interface Contact {
  id: string;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  contactType: ContactType;
  updatedAt: string;
}

export interface ContactInput {
  name: string;
  title?: string;
  email: string;
  phone?: string;
  contactType: ContactType;
}

/** What a contact form shows when the API refuses a save. No em dash (CLAUDE.md 5h). */
export function contactErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "CONTACT_LIMIT_REACHED") return "This company already has 3 contacts. Remove one before adding another.";
    if (error.code === "PRIMARY_CONTACT_EXISTS") return "This company already has a primary contact. Choose another type, or change the current primary contact first.";
    if (error.code === "CONTACT_NOT_FOUND") return "This contact no longer exists. Refresh the list.";
    if (error.status === 400) return "Check the details: a name and a valid email are needed.";
    if (error.status === 403) return "Your role cannot change these contacts.";
  }
  return "The contact could not be saved. Try again.";
}

/** Drops empty optional fields so the API receives only what was entered. */
export function cleanContactInput(input: ContactInput): ContactInput {
  const out: ContactInput = { name: input.name.trim(), email: input.email.trim(), contactType: input.contactType };
  if (input.title?.trim()) out.title = input.title.trim();
  if (input.phone?.trim()) out.phone = input.phone.trim();
  return out;
}

/** The mutations a ContactsEditor needs, so one component serves both routes. */
export interface ContactsApi {
  create: (input: ContactInput) => Promise<unknown>;
  update: (id: string, input: ContactInput) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}
