// SPEC-038 US-004..US-006. The Org Admin's own organisation: overview, activity trail, contacts.
// The organisation comes from the session on the server; there is no orgId in these requests.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Contact, ContactInput, ContactsApi } from "./contacts";

export interface MonthlyPoint {
  month: string;
  tasksCreated: number;
  tasksCompleted: number;
  proceduresPublished: number;
}

export interface OrgOverview {
  generatedAt?: string;
  procedures: { draft: number; pendingApproval: number; published: number; archived: number; publishedLast30d: number };
  routines: { active: number; inactive: number; inspectionsPublished: number };
  tasks: {
    open: number;
    inProgress: number;
    submittedForReview: number;
    redoRequired: number;
    overdue: number;
    createdLast30d: number;
    completedLast30d: number;
  };
  audits: { total: number; last30d: number };
  bdas: { total: number; last30d: number };
  monthly: MonthlyPoint[];
}

export const TRAIL_SOURCES = ["TASK", "PEOPLE", "CONTENT", "AUDIT"] as const;
export type TrailSource = (typeof TRAIL_SOURCES)[number];

export const TRAIL_SOURCE_LABEL: Record<TrailSource, string> = {
  TASK: "Tasks",
  PEOPLE: "People",
  CONTENT: "Content",
  AUDIT: "Audits",
};

export interface TrailEntry {
  id: string;
  occurredAt: string;
  source: TrailSource;
  action: string;
  summary: string;
  actor: { id: string | null; name: string | null };
  subject: { type: string; id: string | null; title: string | null };
}

export interface TrailPage {
  items: TrailEntry[];
  page: number;
  limit: number;
  total: number;
}

export interface TrailQuery {
  page: number;
  limit?: number;
  source?: TrailSource;
  /** yyyy-mm-dd from a date input; sent as the start of that day in the viewer's zone. */
  from?: string;
  /** yyyy-mm-dd; sent as the end of that day in the viewer's zone. */
  to?: string;
}

export const TRAIL_PAGE_SIZE = 50;

/** Builds the query string; exported for tests. */
export function trailSearch(q: TrailQuery): string {
  const p = new URLSearchParams();
  p.set("page", String(q.page));
  p.set("limit", String(q.limit ?? TRAIL_PAGE_SIZE));
  if (q.source) p.set("source", q.source);
  if (q.from) p.set("from", new Date(`${q.from}T00:00:00`).toISOString());
  if (q.to) p.set("to", new Date(`${q.to}T23:59:59.999`).toISOString());
  return p.toString();
}

export function useOrgOverview(userId: string) {
  return useQuery({
    queryKey: ["org-admin", "overview", userId],
    queryFn: () => apiFetch<OrgOverview>("/org-admin/overview"),
  });
}

export function useActivityTrail(userId: string, q: TrailQuery) {
  return useQuery({
    queryKey: ["org-admin", "trail", userId, q],
    queryFn: () => apiFetch<TrailPage>(`/org-admin/trail?${trailSearch(q)}`),
    placeholderData: keepPreviousData,
  });
}

export function useOrgContacts(userId: string) {
  return useQuery({
    queryKey: ["org-admin", "contacts", userId],
    queryFn: async () => (await apiFetch<{ items: Contact[] }>("/org-admin/contacts")).items,
  });
}

export function useOrgContactsApi(userId: string): ContactsApi {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["org-admin", "contacts", userId] });
  const create = useMutation({
    mutationFn: (input: ContactInput) => apiFetch("/org-admin/contacts", { method: "POST", json: input }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContactInput }) =>
      apiFetch(`/org-admin/contacts/${encodeURIComponent(id)}`, { method: "PUT", json: input }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/org-admin/contacts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return {
    create: (input) => create.mutateAsync(input),
    update: (id, input) => update.mutateAsync({ id, input }),
    remove: (id) => remove.mutateAsync(id),
  };
}
