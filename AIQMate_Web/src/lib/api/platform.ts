// SPEC-038 US-001..US-003. The Super Admin's platform reads and writes. Account details, contacts
// and aggregate counts only: no people's data, no content, no approvals (ADR-012 §7).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Contact, ContactInput, ContactsApi } from "./contacts";
import type { MonthlyPoint, OrgOverview } from "./orgAdmin";

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED";

export const HEALTH_REASONS = [
  "TRIAL_ENDING_SOON",
  "TRIAL_EXPIRED",
  "SEATS_NEARLY_FULL",
  "NO_RECENT_ACTIVITY",
  "FEW_CONTACTS",
] as const;
export type HealthReason = (typeof HEALTH_REASONS)[number];

/** SPEC-038 US-001 AC-2, in words. */
export const HEALTH_REASON_LABEL: Record<HealthReason, string> = {
  TRIAL_ENDING_SOON: "Trial ends within 7 days",
  TRIAL_EXPIRED: "Trial has ended",
  SEATS_NEARLY_FULL: "Seats nearly full",
  NO_RECENT_ACTIVITY: "No activity in 30 days",
  FEW_CONTACTS: "Fewer than 2 contacts",
};

export function healthReasonLabel(reason: string): string {
  return (HEALTH_REASON_LABEL as Record<string, string>)[reason] ?? reason.replace(/_/g, " ").toLowerCase();
}

export interface TenantSummary {
  orgId: string;
  name: string;
  industry: string | null;
  country: string | null;
  subscription: { status: SubscriptionStatus; trialEndsAt: string | null };
  seats: { limit: number; used: number };
  primaryContact: Contact | null;
  contactCount: number;
  activeUsers30d: number;
  lastActivityAt: string | null;
  health: "OK" | "ATTENTION";
  reasons: string[];
}

export interface TenantProfile {
  industry: string | null;
  country: string | null;
  website: string | null;
  /** SPEC-039 US-006: the industry pack. Absent from an API older than SPEC-039. */
  industryPack?: { id: string; name: string; version: number } | null;
}

export type UsageRole = "ORG_ADMIN" | "MANAGER" | "SUPERVISOR" | "OPERATOR" | "EXPERT";

export interface UsageReport {
  generatedAt: string;
  users: {
    active: number;
    invited: number;
    suspended: number;
    deactivated: number;
    activeLast30d: number;
    byRole: Partial<Record<UsageRole, number>>;
  };
  content: Omit<OrgOverview, "generatedAt">;
  ai: { month: string; jobs: number; estCostUsd: number; capUsd: number | null };
  adoption: Record<string, boolean>;
}

export interface TenantDetail {
  tenant: TenantSummary;
  profile: TenantProfile;
  contacts: Contact[];
  usage: UsageReport;
}

export interface PlatformInsights {
  generatedAt: string;
  tenants: { total: number; trial: number; active: number; expired: number };
  seats: { limit: number; used: number };
  users: { active: number; activeLast30d: number };
  adoption: { feature: string; tenantsUsing: number }[];
  ai: { month: string; jobs: number; estCostUsd: number };
  monthly: MonthlyPoint[];
  attention: TenantSummary[];
}

/** `null` clears a field; the API reads a missing key as "unchanged" (SPEC-038 US-002 AC-1). */
export interface ProfileInput {
  industry: string | null;
  country: string | null;
  website: string | null;
}

export function usePlatformInsights(userId: string) {
  return useQuery({
    queryKey: ["platform", "insights", userId],
    queryFn: () => apiFetch<PlatformInsights>("/platform/insights"),
  });
}

export function useTenants(userId: string) {
  return useQuery({
    queryKey: ["platform", "tenants", userId],
    queryFn: async () => (await apiFetch<{ items: TenantSummary[] }>("/platform/tenants")).items,
  });
}

export function useTenant(userId: string, orgId: string) {
  return useQuery({
    queryKey: ["platform", "tenant", userId, orgId],
    queryFn: () => apiFetch<TenantDetail>(`/platform/tenants/${encodeURIComponent(orgId)}`),
  });
}

function useRefreshTenant(userId: string, orgId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["platform", "tenant", userId, orgId] }),
      qc.invalidateQueries({ queryKey: ["platform", "tenants", userId] }),
      qc.invalidateQueries({ queryKey: ["platform", "insights", userId] }),
    ]);
}

export function useUpdateTenantProfile(userId: string, orgId: string) {
  const refresh = useRefreshTenant(userId, orgId);
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<{ profile: TenantProfile }>(`/platform/tenants/${encodeURIComponent(orgId)}/profile`, {
        method: "PUT",
        json: input,
      }),
    onSuccess: refresh,
  });
}

export function useTenantContactsApi(userId: string, orgId: string): ContactsApi {
  const refresh = useRefreshTenant(userId, orgId);
  const base = `/platform/tenants/${encodeURIComponent(orgId)}/contacts`;
  const create = useMutation({
    mutationFn: (input: ContactInput) => apiFetch(base, { method: "POST", json: input }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ContactInput }) =>
      apiFetch(`${base}/${encodeURIComponent(id)}`, { method: "PUT", json: input }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  return {
    create: (input) => create.mutateAsync(input),
    update: (id, input) => update.mutateAsync({ id, input }),
    remove: (id) => remove.mutateAsync(id),
  };
}
