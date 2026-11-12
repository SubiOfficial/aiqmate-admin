import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingTier {
  id?: string;
  minimumQuantity: number;
  maximumQuantity: number | null;
  unitRate: string;
  tierOrder: number;
}

export interface ProcedureCategory {
  id: string;
  key: string;
  displayName: string;
  isActive: boolean;
}

export interface PricingConfig {
  id: string;
  tenantId: string;
  categoryId: string | null;
  pricingScope: string;
  pricingModel: "GRADUATED" | "VOLUME";
  billingPeriod: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  tiers: PricingTier[];
  category?: ProcedureCategory | null;
}

export interface PricingPreviewLine {
  slabMin: number;
  slabMax: number | null;
  qty: number;
  unitRate: string;
  amount: string;
}

export interface PricingPreviewResult {
  model: string;
  currency: string;
  quantity: number;
  lines: PricingPreviewLine[];
  subtotal: string;
}

export interface CreatePricingInput {
  tenantId: string;
  categoryId?: string | null;
  pricingScope?: string;
  pricingModel: "GRADUATED" | "VOLUME";
  billingPeriod: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status?: string;
  tiers: Omit<PricingTier, "id">[];
}

export interface PreviewInput {
  pricingModel: "GRADUATED" | "VOLUME";
  quantity: number;
  currency: string;
  tiers: Omit<PricingTier, "id">[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useProcedureCategories() {
  return useQuery({
    queryKey: ["procedure-categories"],
    queryFn: async () => (await apiFetch<{ items: ProcedureCategory[] }>("/procedure-categories")).items,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePricingConfigs(tenantId: string | null) {
  return useQuery({
    queryKey: ["pricing", "configs", tenantId],
    queryFn: async () => (await apiFetch<{ items: PricingConfig[] }>(`/pricing/configs?tenantId=${tenantId}`)).items,
    enabled: !!tenantId,
  });
}

export function usePricingConfig(configId: string | null) {
  return useQuery({
    queryKey: ["pricing", "config", configId],
    queryFn: () => apiFetch<PricingConfig>(`/pricing/configs/${configId}`),
    enabled: !!configId,
  });
}

export function useCreatePricingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePricingInput) =>
      apiFetch<PricingConfig>("/pricing/configs", { method: "POST", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing"] }),
  });
}

export function useUpdatePricingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreatePricingInput }) =>
      apiFetch<PricingConfig>(`/pricing/configs/${id}`, { method: "PUT", json: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing"] }),
  });
}

export function useActivateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PricingConfig>(`/pricing/configs/${id}/activate`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing"] }),
  });
}

export function useDeactivateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<PricingConfig>(`/pricing/configs/${id}/deactivate`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pricing"] }),
  });
}

export function usePricingPreview() {
  return useMutation({
    mutationFn: (input: PreviewInput) =>
      apiFetch<PricingPreviewResult>("/pricing/preview", { method: "POST", json: input }),
  });
}

export function useTenantPricingView(userId: string) {
  return useQuery({
    queryKey: ["pricing", "tenant-view", userId],
    queryFn: async () => (await apiFetch<{ items: PricingConfig[] }>("/pricing/tenant-view")).items,
  });
}
