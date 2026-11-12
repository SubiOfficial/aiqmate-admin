import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Hierarchy level configuration (per-tenant)
// ---------------------------------------------------------------------------

export interface HierarchyLevel {
  id: string;
  tenantId: string;
  levelKey: string;
  displayName: string;
  pluralName: string;
  levelOrder: number;
  isEnabled: boolean;
  isRootLevel: boolean;
  allowMultipleChildren: boolean;
  icon: string | null;
}

export interface HierarchyConfigInput {
  levels: {
    levelKey: string;
    displayName: string;
    pluralName: string;
    levelOrder: number;
    isEnabled: boolean;
    isRootLevel: boolean;
    allowMultipleChildren: boolean;
    icon?: string | null;
  }[];
}

export function useHierarchyConfig(userId: string) {
  return useQuery({
    queryKey: ["asset-hierarchy", "config", userId],
    queryFn: () => apiFetch<HierarchyLevel[]>("/asset-hierarchy/config"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveHierarchyConfig(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HierarchyConfigInput) =>
      apiFetch<HierarchyLevel[]>("/asset-hierarchy/config", { method: "PUT", json: input }),
    onSuccess: (data) => {
      qc.setQueryData(["asset-hierarchy", "config", userId], data);
    },
  });
}

// ---------------------------------------------------------------------------
// Asset hierarchy tree
// ---------------------------------------------------------------------------

export interface AssetNode {
  id: string;
  tenantId: string;
  parentAssetId: string | null;
  hierarchyLevelId: string;
  assetCode: string;
  defaultName: string;
  displayName: string | null;
  status: string;
  criticality: string;
  location: string | null;
  assetClass: string | null;
  assetModel: string | null;
  modelTemplateId: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  children: AssetNode[];
  /** Aggregate counts, attached by the API. */
  procedureCount?: number;
  arPinCount?: number;
  insightCount?: number;
}

export interface AssetDetail extends Omit<AssetNode, "children"> {
  hierarchyLevel: HierarchyLevel;
  procedureCount: number;
  arPinCount: number;
  insightCount: number;
}

export interface CreateAssetInput {
  parentAssetId: string | null;
  hierarchyLevelId: string;
  defaultName: string;
  displayName?: string | null;
  status?: string;
  criticality?: string;
  location?: string | null;
}

export interface UpdateAssetInput {
  defaultName?: string;
  displayName?: string | null;
  status?: string;
  criticality?: string;
  location?: string | null;
  assetClass?: string | null;
  assetModel?: string | null;
}

export function useAssetHierarchy(userId: string) {
  return useQuery({
    queryKey: ["asset-hierarchy", "tree", userId],
    queryFn: () => apiFetch<AssetNode[]>("/assets/hierarchy"),
  });
}

export function useAssetDetail(userId: string, assetId: string | null) {
  return useQuery({
    queryKey: ["asset-hierarchy", "detail", userId, assetId],
    queryFn: () => apiFetch<AssetDetail>(`/assets/${assetId}`),
    enabled: assetId !== null,
  });
}

function useRefreshTree(userId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["asset-hierarchy", "tree", userId] }),
      qc.invalidateQueries({ queryKey: ["asset-hierarchy", "detail", userId] }),
    ]);
}

export function useCreateAsset(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: (input: CreateAssetInput) =>
      apiFetch<AssetNode>("/assets", { method: "POST", json: input }),
    onSuccess: refresh,
  });
}

export function useUpdateAsset(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAssetInput }) =>
      apiFetch<AssetNode>(`/assets/${encodeURIComponent(id)}`, { method: "PUT", json: input }),
    onSuccess: refresh,
  });
}

export function useRenameAsset(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: ({ id, displayName }: { id: string; displayName: string | null }) =>
      apiFetch<AssetNode>(`/assets/${encodeURIComponent(id)}/rename`, { method: "PATCH", json: { displayName } }),
    onSuccess: refresh,
  });
}

export function useMoveAsset(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: ({ id, newParentId }: { id: string; newParentId: string | null }) =>
      apiFetch<AssetNode>(`/assets/${encodeURIComponent(id)}/move`, { method: "PATCH", json: { newParentId } }),
    onSuccess: refresh,
  });
}

export function useToggleAssetStatus(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch<AssetNode>(`/assets/${encodeURIComponent(id)}/status`, { method: "PATCH", json: { isActive } }),
    onSuccess: refresh,
  });
}

export function useDeleteAsset(userId: string) {
  const refresh = useRefreshTree(userId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/assets/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function assetName(node: { defaultName: string; displayName: string | null }): string {
  return node.displayName?.trim() || node.defaultName;
}

export function nextChildLevel(
  levels: HierarchyLevel[],
  parentLevelId: string | null,
): HierarchyLevel | null {
  const sorted = [...levels].filter((l) => l.isEnabled).sort((a, b) => a.levelOrder - b.levelOrder);
  if (!parentLevelId) return sorted.find((l) => l.isRootLevel) ?? sorted[0] ?? null;
  const parentIdx = sorted.findIndex((l) => l.id === parentLevelId);
  if (parentIdx < 0 || parentIdx >= sorted.length - 1) return null;
  return sorted[parentIdx + 1];
}

export function flattenTree(nodes: AssetNode[]): AssetNode[] {
  const result: AssetNode[] = [];
  function walk(list: AssetNode[]) {
    for (const n of list) {
      result.push(n);
      if (n.children.length > 0) walk(n.children);
    }
  }
  walk(nodes);
  return result;
}
