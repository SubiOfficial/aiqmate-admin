// SPEC-039. The tenant's effective metadata (module names, on/off, order, custom fields), the Org
// Admin's configuration writes, and the Super Admin's industry pack. Tenant names are display-only
// (ADR-014 §1): keys and API fields never change.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isPlatformRole, type Role } from "@/lib/auth/roles";
import { DEFAULT_ORDER, MODULE_REGISTRY, type ModuleKey } from "@/lib/modules";
import { ApiError, apiFetch } from "./client";

export const FIELD_KINDS = ["TEXT", "NUMBER", "DATE", "CHOICE", "BOOLEAN"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const FIELD_KIND_LABEL: Record<FieldKind, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  CHOICE: "Choice",
  BOOLEAN: "Yes or no",
};

export interface PackRef {
  id: string;
  name: string;
  version: number;
}

export interface EffectiveModule {
  key: ModuleKey;
  singular: string;
  plural: string;
  enabled: boolean;
  order: number;
  defaultSingular: string;
  defaultPlural: string;
  defaultEnabled: boolean;
  defaultOrder: number;
  supportsCustomFields: boolean;
  customised: boolean;
}

export interface CustomFieldDto {
  id: string;
  moduleKey: ModuleKey;
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: string[];
  helpText: string | null;
  order: number;
  source: "PACK" | "ORG";
  archivedAt: string | null;
}

export interface EffectiveMetadata {
  orgId: string;
  pack: PackRef;
  metadataVersion: number;
  modules: EffectiveModule[];
  fields: Partial<Record<ModuleKey, CustomFieldDto[]>>;
}

export interface ModuleInput {
  key: ModuleKey;
  enabled: boolean;
  order: number;
  singular: string;
  plural: string;
}

export interface FieldInput {
  moduleKey: ModuleKey;
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  options: string[];
  helpText: string | null;
}

export interface FieldUpdate {
  label: string;
  required: boolean;
  options: string[];
  helpText: string | null;
  order: number;
}

export interface PackSummary {
  id: string;
  name: string;
  version: number;
  description: string;
  starterFieldCount: number;
}

export type FieldValue = string | number | boolean;

export interface ContentFields {
  moduleKey: ModuleKey;
  id: string;
  values: Record<string, FieldValue>;
  fields: CustomFieldDto[];
}

export const GENERAL_MANUFACTURING: PackRef = { id: "GENERAL_MANUFACTURING", name: "General manufacturing", version: 1 };

const metadataKey = (userId: string) => ["org-metadata", userId] as const;

/**
 * US-001 AC-4: a Super Admin never asks for a tenant's metadata (platform role, ADR-012 §7).
 * Operators do not use the portal, so every other role may.
 */
export function useOrgMetadata(userId: string, roles: readonly Role[]) {
  return useQuery({
    queryKey: metadataKey(userId),
    queryFn: () => apiFetch<EffectiveMetadata>("/org-metadata"),
    enabled: !isPlatformRole(roles),
    staleTime: 5 * 60 * 1000,
  });
}

/** FR-MD-011: the tenant's name for a module, or the standard name while metadata is not loaded. */
export function moduleName(meta: EffectiveMetadata | undefined, key: ModuleKey, form: "singular" | "plural"): string {
  const m = meta?.modules.find((x) => x.key === key);
  const name = m?.[form]?.trim();
  return name || MODULE_REGISTRY[key][form];
}

/** The modules a tenant has switched on, in its order. Without metadata: every module, standard order. */
export function enabledModules(meta: EffectiveMetadata | undefined): ModuleKey[] {
  if (!meta) return [...DEFAULT_ORDER];
  return [...meta.modules]
    .filter((m) => m.enabled && m.key in MODULE_REGISTRY)
    .sort((a, b) => a.order - b.order)
    .map((m) => m.key);
}

export function isModuleEnabled(meta: EffectiveMetadata | undefined, key: ModuleKey): boolean {
  const m = meta?.modules.find((x) => x.key === key);
  return m ? m.enabled : true;
}

/** The active fields of a module, in order (the API already sends active only, sorted). */
export function moduleFields(meta: EffectiveMetadata | undefined, key: ModuleKey): CustomFieldDto[] {
  return [...(meta?.fields[key] ?? [])].filter((f) => !f.archivedAt).sort((a, b) => a.order - b.order);
}

/** US-003 / US-004 / US-005 / US-006 error codes, in words. No em dash (CLAUDE.md 5h). */
export function metadataErrorMessage(error: unknown, fallback = "The change could not be saved. Try again."): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case "AT_LEAST_ONE_MODULE":
      return "Keep at least one module switched on.";
    case "UNKNOWN_MODULE":
      return "That module does not exist. Refresh the page.";
    case "DUPLICATE_MODULE":
      return "A module was listed twice. Refresh the page and try again.";
    case "INVALID_ORDER":
      return "Two modules have the same position. Refresh the page and try again.";
    case "MODULE_HAS_NO_FIELDS":
      return "This module does not take custom fields.";
    case "FIELD_KEY_EXISTS":
      return "A field with this key already exists in this module, maybe archived. Choose another key.";
    case "FIELD_LIMIT_REACHED":
      return "This module already has 20 active fields. Archive one first.";
    case "FIELD_KEY_IMMUTABLE":
      return "A field's key cannot be changed.";
    case "FIELD_KIND_IMMUTABLE":
      return "A field's kind cannot be changed.";
    case "FIELD_NOT_FOUND":
      return "This field no longer exists. Refresh the page.";
    case "UNKNOWN_FIELD":
      return "One of the fields no longer exists. Refresh and try again.";
    case "INVALID_FIELD_VALUE":
      return "One of the values is not valid for its field. Check the highlighted entries.";
    case "REQUIRED_FIELD_MISSING":
      return "Fill in every required field.";
    case "CONTENT_NOT_FOUND":
      return "This item no longer exists.";
    case "UNKNOWN_PACK":
      return "That industry pack does not exist. Refresh the page.";
    case "TENANT_NOT_FOUND":
      return "This organisation no longer exists.";
  }
  if (error.status === 403) return "Your role cannot make this change.";
  if (error.status === 400) return "Check the details and try again.";
  return fallback;
}

// ---- Org Admin configuration (US-003, US-004) ----

function useRefreshMetadata(userId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["org-metadata"] }),
      qc.invalidateQueries({ queryKey: ["org-admin", "fields", userId] }),
    ]);
}

export function useSaveModules(userId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshMetadata(userId);
  return useMutation({
    mutationFn: (modules: ModuleInput[]) =>
      apiFetch<EffectiveMetadata>("/org-admin/metadata/modules", { method: "PUT", json: { modules } }),
    onSuccess: async (data) => {
      // US-003 AC-1: the menu follows at once, then the cache is refreshed from the server.
      qc.setQueryData(metadataKey(userId), data);
      await refresh();
    },
  });
}

export function useResetModules(userId: string) {
  const qc = useQueryClient();
  const refresh = useRefreshMetadata(userId);
  return useMutation({
    mutationFn: () => apiFetch<EffectiveMetadata>("/org-admin/metadata/modules/reset", { method: "POST" }),
    onSuccess: async (data) => {
      qc.setQueryData(metadataKey(userId), data);
      await refresh();
    },
  });
}

export function useAllFields(userId: string) {
  return useQuery({
    queryKey: ["org-admin", "fields", userId],
    queryFn: () => apiFetch<CustomFieldDto[]>("/org-admin/metadata/fields?includeArchived=true"),
  });
}

export function useFieldMutations(userId: string) {
  const refresh = useRefreshMetadata(userId);
  const base = "/org-admin/metadata/fields";
  const create = useMutation({
    mutationFn: (input: FieldInput) => apiFetch<CustomFieldDto>(base, { method: "POST", json: input }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: FieldUpdate }) =>
      apiFetch<CustomFieldDto>(`${base}/${encodeURIComponent(id)}`, { method: "PUT", json: input }),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: (id: string) => apiFetch<CustomFieldDto>(`${base}/${encodeURIComponent(id)}/restore`, { method: "POST" }),
    onSuccess: refresh,
  });
  return {
    create: (input: FieldInput) => create.mutateAsync(input),
    update: (id: string, input: FieldUpdate) => update.mutateAsync({ id, input }),
    archive: (id: string) => archive.mutateAsync(id),
    restore: (id: string) => restore.mutateAsync(id),
  };
}

// ---- Custom field values (US-005) ----

const contentPath = (moduleKey: ModuleKey, id: string) =>
  `/content/${moduleKey}/${encodeURIComponent(id)}/custom-fields`;

export function useContentFields(userId: string, moduleKey: ModuleKey, id: string | null) {
  return useQuery({
    queryKey: ["content-fields", userId, moduleKey, id],
    queryFn: () => apiFetch<ContentFields>(contentPath(moduleKey, id as string)),
    enabled: id !== null,
  });
}

export function useSaveContentFields(userId: string, moduleKey: ModuleKey, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: Record<string, FieldValue | null>) =>
      apiFetch<ContentFields>(contentPath(moduleKey, id), { method: "PUT", json: { values } }),
    onSuccess: (data) => qc.setQueryData(["content-fields", userId, moduleKey, id], data),
  });
}

// ---- Super Admin industry pack (US-006) ----

export function usePacks(userId: string) {
  return useQuery({
    queryKey: ["platform", "packs", userId],
    queryFn: () => apiFetch<PackSummary[]>("/platform/packs"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useApplyPack(userId: string, orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<{ orgId: string; pack: PackRef; metadataVersion: number }>(
        `/platform/tenants/${encodeURIComponent(orgId)}/pack`,
        { method: "PUT", json: { packId } },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "tenant", userId, orgId] }),
  });
}
