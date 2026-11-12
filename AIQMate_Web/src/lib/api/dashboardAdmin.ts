import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface DashboardSummaryResponse {
  tenants: { total: number; active: number; inactive: number };
  users: { total: number };
  procedures: { total: number; billable: number; nonBillable: number };
  revenue: { totalInvoiced: string; totalCollected: string; totalOutstanding: string; totalRefunded: string; currency: string };
  subscriptions: { active: number; expiringSoon: number; expired: number; trial: number };
  payments: { pending: number; failed: number };
}

export interface RevenueTenantRow {
  tenantId: string;
  orgId: string;
  name: string;
  totalInvoiced: string;
  totalPaid: string;
  outstanding: string;
  refunded: string;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  lastPaymentDate: string | null;
  paymentStatus: string;
}

export interface RevenueBreakdownResponse {
  items: RevenueTenantRow[];
  total: number;
  page: number;
  limit: number;
  summary: { totalInvoiced: string; totalCollected: string; totalOutstanding: string; totalRefunded: string };
}

export interface TenantDetailRow {
  id: string;
  orgId: string;
  name: string;
  industry: string | null;
  country: string | null;
  status: string;
  health: string;
  subscription: {
    plan: string;
    status: string;
    model: string;
    startDate: string;
    endDate: string | null;
    trialEndsAt: string | null;
    renewalDate: string | null;
    billingCycle: string;
    monthlyRate: string;
    currency: string;
  } | null;
  primaryContact: { name: string; email: string } | null;
  procedures: { total: number; billable: number };
  billing: { invoiced: string; paid: string; outstanding: string };
  lastPaymentDate: string | null;
  lastActivityAt: string | null;
  assetCount: number;
  seatsUsed: number;
  seatLimit: number;
  createdAt: string;
}

export interface TenantsDetailResponse {
  items: TenantDetailRow[];
  total: number;
  page: number;
  limit: number;
}

export interface SubscriptionExpiryRow {
  tenantId: string;
  orgId: string;
  tenantName: string;
  plan: string;
  status: string;
  expiryStatus: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  renewalDate: string | null;
  billingCycle: string;
  monthlyRate: string;
  currency: string;
  autoRenew: boolean;
  progress: number;
  remainingDays: number;
  totalDurationDays: number;
}

export interface SubscriptionsExpiryResponse {
  items: SubscriptionExpiryRow[];
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-admin", "summary"],
    queryFn: () => apiFetch<DashboardSummaryResponse>("/dashboard/summary"),
    staleTime: 30_000,
  });
}

export function useRevenueBreakdown(search: string, page: number) {
  return useQuery({
    queryKey: ["dashboard-admin", "revenue", search, page],
    queryFn: () =>
      apiFetch<RevenueBreakdownResponse>(
        `/dashboard/revenue?search=${encodeURIComponent(search)}&page=${page}&limit=10`,
      ),
    staleTime: 30_000,
  });
}

export function useTenantsDetail(search: string, status: string, page: number, sort: string, order: string) {
  return useQuery({
    queryKey: ["dashboard-admin", "tenants-detail", search, status, page, sort, order],
    queryFn: () =>
      apiFetch<TenantsDetailResponse>(
        `/dashboard/tenants-detail?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page}&limit=5&sort=${sort}&order=${order}`,
      ),
    staleTime: 30_000,
  });
}

export function useSubscriptionsExpiry() {
  return useQuery({
    queryKey: ["dashboard-admin", "subscriptions-expiry"],
    queryFn: () => apiFetch<SubscriptionsExpiryResponse>("/dashboard/subscriptions-expiry"),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Drill-down response types
// ---------------------------------------------------------------------------

export interface UserSummaryResponse {
  summary: { total: number; active: number; inactive: number; byRole: { role: string; count: number }[] };
  items: { userId: string; email: string; firstName: string | null; lastName: string | null; isActive: boolean; lastLoginAt: string | null; tenantId: string; tenantName: string; tenantOrgId: string; role: string; roleKey: string; createdAt: string }[];
  total: number; page: number; limit: number;
}

export interface ProceduresSummaryResponse {
  summary: { total: number; completed: number; failed: number; cancelled: number; pending: number; billable: number; nonBillable: number };
  byTenant: { tenantId: string; tenantName: string; orgId: string; total: number; billable: number; nonBillable: number }[];
  byCategory: { categoryId: string; categoryName: string; categoryKey: string; total: number; billable: number }[];
  items: { id: string; tenantName: string; tenantOrgId: string; userName: string; categoryName: string; status: string; isBillable: boolean; quantity: number; amount: string | null; startedAt: string; completedAt: string | null }[];
  total: number; page: number; limit: number;
}

export interface PaymentsDetailResponse {
  summary: { totalCollected: string; totalPending: string; totalFailed: string; totalRefunded: string; transactionCount: number; payingTenants: number; byMethod: { method: string; count: number; total: string }[] };
  items: { id: string; tenantName: string; tenantOrgId: string; invoiceNumber: string | null; amount: string; currency: string; status: string; paymentMethod: string | null; transactionId: string | null; paidAt: string | null; failedAt: string | null; refundedAmount: string; createdAt: string }[];
  total: number; page: number; limit: number;
}

export interface OutstandingDetailResponse {
  items: { id: string; tenantName: string; tenantOrgId: string; invoiceNumber: string; total: string; outstanding: string; currency: string; status: string; dueDate: string; overdueDays: number; billingPeriodStart: string; billingPeriodEnd: string }[];
  total: number;
  totalOutstanding: string;
}

// ---------------------------------------------------------------------------
// Drill-down hooks
// ---------------------------------------------------------------------------

export function useUsersSummary(search: string, status: string, tenantId: string, role: string, page: number) {
  return useQuery({
    queryKey: ["dashboard-admin", "users-summary", search, status, tenantId, role, page],
    queryFn: () => apiFetch<UserSummaryResponse>(`/dashboard/users-summary?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&tenantId=${encodeURIComponent(tenantId)}&role=${encodeURIComponent(role)}&page=${page}&limit=10`),
    staleTime: 30_000,
  });
}

export function useProceduresSummary(search: string, status: string, tenantId: string, categoryId: string, page: number) {
  return useQuery({
    queryKey: ["dashboard-admin", "procedures-summary", search, status, tenantId, categoryId, page],
    queryFn: () => apiFetch<ProceduresSummaryResponse>(`/dashboard/procedures-summary?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&tenantId=${encodeURIComponent(tenantId)}&categoryId=${encodeURIComponent(categoryId)}&page=${page}&limit=10`),
    staleTime: 30_000,
  });
}

export function usePaymentsDetail(search: string, status: string, tenantId: string, page: number) {
  return useQuery({
    queryKey: ["dashboard-admin", "payments-detail", search, status, tenantId, page],
    queryFn: () => apiFetch<PaymentsDetailResponse>(`/dashboard/payments-detail?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&tenantId=${encodeURIComponent(tenantId)}&page=${page}&limit=10`),
    staleTime: 30_000,
  });
}

export function useOutstandingDetail() {
  return useQuery({
    queryKey: ["dashboard-admin", "outstanding-detail"],
    queryFn: () => apiFetch<OutstandingDetailResponse>("/dashboard/outstanding-detail"),
    staleTime: 30_000,
  });
}
