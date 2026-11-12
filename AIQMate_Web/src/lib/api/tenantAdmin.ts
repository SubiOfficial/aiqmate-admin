import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

export interface TenantOverview {
  id: string;
  orgId: string;
  orgCode: string | null;
  name: string;
  industry: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  website: string | null;
  status: string;
  health: string;
  seatLimit: number;
  seatsUsed: number;
  activeUsers30d: number;
  lastActivityAt: string | null;
  billingTimezone: string;
  paymentTermsDays: number;
  activatedAt: string | null;
  createdAt: string;
  activeDays: number;
  daysSinceExpiry: number | null;
}

export interface TenantContact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  designation: string | null;
  contactType: string;
  isPrimary: boolean;
}

export interface TenantSubscription {
  id: string;
  plan: string;
  status: string;
  subscriptionModel: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  renewalDate: string | null;
  billingCycle: string;
  monthlyRate: string;
  includedAllowance: number | null;
  currency: string;
  autoRenew: boolean;
  cancelledAt: string | null;
  cancellationReason: string | null;
  previousPlan: string | null;
  previousMonthlyRate: string | null;
  planChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeDays: number;
  remainingDays: number;
  totalDays: number;
  nextBillingDate: string | null;
}

export interface UsageByCategory {
  categoryKey: string;
  categoryName: string;
  total: number;
  billable: number;
}

export interface TierBreakdown {
  tierOrder: number;
  min: number;
  max: number | null;
  quantity: number;
  rate: string;
  amount: string;
}

export interface AdditionalCharges {
  applicableRate: string;
  additionalQuantity: number;
  estimatedAmount: string;
  breakdown: TierBreakdown[];
}

export interface TenantUsageSummary {
  total: number;
  billable: number;
  nonBillable: number;
  failed: number;
  cancelled: number;
  completed: number;
  includedAllowance: number | null;
  additionalUsed: number;
  remainingIncluded: number;
  currentPeriodUsage: number;
  previousPeriodUsage: number;
  usageByCategory: UsageByCategory[];
  additionalCharges: AdditionalCharges | null;
}

export interface TenantUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  role: string;
  roleKey: string;
}

export interface TenantPricingTier {
  tierOrder: number;
  minimumQuantity: number;
  maximumQuantity: number | null;
  unitRate: string;
}

export interface TenantPricingConfig {
  id: string;
  categoryName: string;
  pricingModel: string;
  billingPeriod: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  version: number;
  tiers: TenantPricingTier[];
}

export interface TenantInvoiceSummary {
  id: string;
  invoiceNumber: string;
  status: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  currency: string;
  total: string;
  amountPaid: string;
  outstanding: string;
  dueDate: string;
  createdAt: string;
  itemCount: number;
}

export interface TenantPaymentRecord {
  id: string;
  invoiceNumber: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  transactionId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAmount: string;
  createdAt: string;
}

export interface TenantAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  performedBy: { userId: string; email: string; firstName: string | null; lastName: string | null } | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface HierarchyLevel {
  id: string;
  levelKey: string;
  displayName: string;
  pluralName: string;
  levelOrder: number;
  isEnabled: boolean;
}

export interface TenantBilling {
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  totalRefunded: string;
  pendingPayments: number;
  failedPayments: number;
  overdueInvoices: number;
  lastInvoiceDate: string | null;
  nextBillingDate: string | null;
  invoices: TenantInvoiceSummary[];
}

export interface TenantFullDetail {
  overview: TenantOverview;
  contacts: TenantContact[];
  subscription: TenantSubscription | null;
  usage: TenantUsageSummary;
  users: TenantUser[];
  assetCount: number;
  hierarchyLevels: HierarchyLevel[];
  pricing: TenantPricingConfig[];
  billing: TenantBilling;
  payments: TenantPaymentRecord[];
  auditLog: TenantAuditEntry[];
}

export function useTenantFull(tenantId: string | null) {
  return useQuery({
    queryKey: ["tenant-full", tenantId],
    queryFn: () => apiFetch<TenantFullDetail>(`/dashboard/tenant/${tenantId}/full`),
    enabled: tenantId !== null,
    staleTime: 30_000,
  });
}

export function useTenantIdByOrg(orgId: string) {
  return useQuery({
    queryKey: ["tenant-id-lookup", orgId],
    queryFn: async () => {
      const res = await apiFetch<{ items: { id: string; orgId: string }[] }>("/dashboard/tenants-detail?search=" + encodeURIComponent(orgId) + "&limit=50");
      const match = res.items.find((t) => t.orgId === orgId);
      return match?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { tenantId: string; data: Partial<TenantOverview> }) =>
      apiFetch<TenantOverview>(`/dashboard/tenant/${args.tenantId}`, { method: "PUT", json: args.data }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-full"] }); },
  });
}

export function useSubscriptionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { tenantId: string; action: string; reason?: string; extendDays?: number }) =>
      apiFetch<TenantSubscription>(`/dashboard/tenant/${args.tenantId}/subscription/action`, { method: "POST", json: args }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["tenant-full"] }); },
  });
}
