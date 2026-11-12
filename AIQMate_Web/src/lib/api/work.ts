// SPEC-039 US-002. The lists behind the Work module pages: Lookup for procedures, routines,
// inspections, guides and BDAs (one shape for all five), and activities for tasks.

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { LookupType } from "@/lib/modules";
import { apiFetch } from "./client";

/** The fields of a LookupItemDto the module page shows (api-service lookup-item.dto.ts). */
export interface LookupItem {
  id: string;
  templateId: string;
  title: string;
  type: string;
  status: string;
  category?: string | null;
  assetName: string | null;
  updatedAt: string;
  createdByName: string;
  version?: string | null;
}

export interface LookupResponse {
  data: LookupItem[];
  meta: { total: number };
}

/** The fields of an ActivityResponseDto the Tasks page shows. */
export interface ActivityItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assignedToName: string | null;
  dueDate: string | null;
  assetFullPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityPage {
  data: ActivityItem[];
  nextCursor: string | null;
  total?: number;
}

export const TASK_PAGE_SIZE = 50;

export function useLookupList(userId: string, type: LookupType | null) {
  return useQuery({
    queryKey: ["work", "lookup", userId, type],
    queryFn: async () => {
      const res = await apiFetch<LookupResponse>(`/lookup?type=${encodeURIComponent(type as string)}`);
      // Lookup's `Procedure` filter also returns guides (the mobile chips rely on that). A module
      // page lists its own type only, so a guide is not shown under Procedures (or SOPs).
      const want = (type as string).toUpperCase();
      const data = res.data.filter((i) => i.type === want);
      return { ...res, data, meta: { ...res.meta, total: data.length } };
    },
    enabled: type !== null,
  });
}

export function useTaskList(userId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["work", "tasks", userId],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(TASK_PAGE_SIZE) });
      if (pageParam) qs.set("after", pageParam);
      return apiFetch<ActivityPage>(`/activities?${qs.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}
