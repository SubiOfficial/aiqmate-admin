// SPEC-036 US-003. The dashboard's reads. Shapes mirror api-service
// modules/dashboard/dto/dashboard-home.dto.ts and dashboard-summary.dto.ts (only the fields used).
// Every key carries the signed-in user id (FR-WEB-022).

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface HomeKpis {
  tasks: { count: number; inProgress: number };
  procedures: number;
  routines: number;
  inspections: number;
  bda: number;
  audits: number;
  areaMaps: number;
}

export interface DashboardHome {
  kpis: HomeKpis;
}

export interface Activity {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
}

export type DashboardSummary =
  | {
      role: "supervisor";
      kpis: { procedures: number; activities: number; pendingApprovals: number; assets: number };
      recentActivities: Activity[];
    }
  | {
      role: "operator";
      kpis: { tasks: number; inProgress: number };
      activities: Activity[];
    };

export function useDashboardHome(userId: string) {
  return useQuery({
    queryKey: ["dashboard", "home", userId],
    queryFn: () => apiFetch<DashboardHome>("/dashboard/home"),
  });
}

export function useDashboardSummary(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "summary", userId],
    queryFn: () => apiFetch<DashboardSummary>("/dashboard/summary"),
    enabled,
  });
}

/** Approvals waiting across every submission type. Non-approvers get total 0, not 403. */
export function usePendingApprovalsCount(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "count", userId],
    queryFn: async () => (await apiFetch<{ total: number }>("/approvals?page=1&limit=1")).total,
    enabled,
  });
}
