import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  categoryId: string | null;
  description: string;
  pricingModel: string;
  pricingConfigId: string | null;
  pricingSnapshot: unknown;
  quantity: number;
  unitRate: string;
  amount: string;
  tierMin: number | null;
  tierMax: number | null;
  tierOrder: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  currency: string;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string;
  discountAmount: string;
  adjustmentAmount: string;
  total: string;
  amountPaid: string;
  outstandingBalance: string;
  status: string;
  dueDate: string;
  paidAt: string | null;
  voidedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  payments?: PaymentRecord[];
  tenant?: { name: string; orgId: string };
}

export interface PaymentRecord {
  id: string;
  tenantId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAmount: string;
  description: string | null;
  transactionId: string | null;
  createdAt: string;
  tenant?: { name: string; orgId: string };
}

export interface BillingCalculation {
  model: string;
  currency: string;
  quantity: number;
  lines: { slabMin: number; slabMax: number | null; qty: number; unitRate: string; amount: string }[];
  subtotal: string;
}

export interface ExecutionSummary {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  billable: number;
  nonBillable: number;
}

export interface SubscriptionInfo {
  id: string;
  tenantId: string;
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
}

// ---------------------------------------------------------------------------
// Billing calculation
// ---------------------------------------------------------------------------

export function useBillingCalculation() {
  return useMutation({
    mutationFn: (input: { tenantId: string; billingPeriod: string; categoryId?: string }) =>
      apiFetch<BillingCalculation>("/billing/calculate", { method: "POST", json: input }),
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantId: string; billingPeriod: string; categoryId?: string }) =>
      apiFetch<Invoice>("/billing/generate-invoice", { method: "POST", json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function useInvoices(tenantId?: string | null, status?: string, page = 1, limit = 20) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (status) params.set("status", status);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return useQuery({
    queryKey: ["invoices", tenantId, status, page, limit],
    queryFn: () => apiFetch<{ items: Invoice[]; total: number }>(`/invoices?${params.toString()}`),
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: ["invoices", "detail", id],
    queryFn: () => apiFetch<Invoice>(`/invoices/${id}`),
    enabled: id !== null,
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Invoice>(`/invoices/${encodeURIComponent(id)}/void`, { method: "PATCH" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { invoiceId: string; amount: string; paymentMethod?: string; transactionId?: string }) =>
      apiFetch<PaymentRecord>("/payments", { method: "POST", json: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
}

export function usePayments(tenantId?: string | null, invoiceId?: string, page = 1, limit = 20) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (invoiceId) params.set("invoiceId", invoiceId);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return useQuery({
    queryKey: ["payments", tenantId, invoiceId, page, limit],
    queryFn: () => apiFetch<{ items: PaymentRecord[]; total: number }>(`/payments?${params.toString()}`),
  });
}

// ---------------------------------------------------------------------------
// Execution summary
// ---------------------------------------------------------------------------

export function useExecutionSummary(billingPeriod?: string) {
  const params = billingPeriod ? `?billingPeriod=${billingPeriod}` : "";
  return useQuery({
    queryKey: ["executions", "summary", billingPeriod],
    queryFn: () => apiFetch<ExecutionSummary>(`/executions/usage-summary${params}`),
  });
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export function useSubscription(tenantId?: string | null) {
  const params = tenantId ? `?tenantId=${tenantId}` : "";
  return useQuery({
    queryKey: ["subscription", tenantId],
    queryFn: () => apiFetch<SubscriptionInfo | null>(`/subscriptions${params}`),
  });
}
