import { PrismaClient, Prisma } from "@prisma/client";
import { Router } from "express";
import { requireSuperAdmin } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/dashboard/summary -- Platform-wide metrics for Super Admin
router.get("/summary", requireSuperAdmin, async (_req, res) => {
  const [
    tenants, users, subs, executions, billableExec,
    invoices, payments, paidPayments, failedPayments, pendingPayments,
  ] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, status: true, health: true } }),
    prisma.user.count(),
    prisma.subscription.findMany({ select: { status: true, endDate: true, trialEndsAt: true, currency: true } }),
    prisma.procedureExecution.count(),
    prisma.procedureExecution.count({ where: { isBillable: true } }),
    prisma.invoice.findMany({ select: { total: true, amountPaid: true, outstandingBalance: true, status: true } }),
    prisma.payment.findMany({ select: { amount: true, status: true, refundedAmount: true } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
  ]);

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalCollected = Number(paidPayments._sum.amount ?? 0);
  const totalOutstanding = invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.outstandingBalance), 0);
  const totalRefunded = payments.reduce((s, p) => s + Number(p.refundedAmount), 0);

  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  res.json({
    tenants: {
      total: tenants.length,
      active: tenants.filter((t) => t.status === "ACTIVE").length,
      inactive: tenants.filter((t) => t.status !== "ACTIVE").length,
    },
    users: { total: users },
    procedures: {
      total: executions,
      billable: billableExec,
      nonBillable: executions - billableExec,
    },
    revenue: {
      totalInvoiced: totalInvoiced.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      currency: (() => { const currencies = subs.map((s) => s.currency).filter(Boolean); if (currencies.length === 0) return "USD"; const freq: Record<string, number> = {}; for (const c of currencies) freq[c] = (freq[c] ?? 0) + 1; return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]; })(),
    },
    subscriptions: {
      active: subs.filter((s) => s.status === "ACTIVE").length,
      expiringSoon: subs.filter((s) => s.status === "ACTIVE" && s.endDate && s.endDate <= soonThreshold && s.endDate > now).length,
      expired: subs.filter((s) => s.status === "EXPIRED" || (s.endDate && s.endDate < now)).length,
      trial: subs.filter((s) => s.status === "TRIAL").length,
    },
    payments: {
      pending: pendingPayments,
      failed: failedPayments,
    },
  });
});

// GET /api/v1/dashboard/revenue -- Revenue breakdown by tenant
router.get("/revenue", requireSuperAdmin, async (req, res) => {
  const { status, search, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.TenantWhereInput = {};
  if (search) where.name = { contains: String(search), mode: "insensitive" };

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      invoices: { select: { total: true, amountPaid: true, outstandingBalance: true, status: true } },
      payments: { select: { amount: true, status: true, refundedAmount: true, paidAt: true } },
    },
    skip,
    take: Number(limit),
    orderBy: { name: "asc" },
  });
  const total = await prisma.tenant.count({ where });

  const items = tenants.map((t) => {
    const invoiced = t.invoices.reduce((s, i) => s + Number(i.total), 0);
    const paid = t.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = t.invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.outstandingBalance), 0);
    const refunded = t.payments.reduce((s, p) => s + Number(p.refundedAmount), 0);
    const successfulPayments = t.payments.filter((p) => p.status === "PAID").length;
    const pendingPayments = t.payments.filter((p) => p.status === "PENDING").length;
    const failedPayments = t.payments.filter((p) => p.status === "FAILED").length;
    const lastPayment = t.payments.filter((p) => p.paidAt).sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))[0];

    return {
      tenantId: t.id,
      orgId: t.orgId,
      name: t.name,
      totalInvoiced: invoiced.toFixed(2),
      totalPaid: paid.toFixed(2),
      outstanding: outstanding.toFixed(2),
      refunded: refunded.toFixed(2),
      successfulPayments,
      pendingPayments,
      failedPayments,
      lastPaymentDate: lastPayment?.paidAt?.toISOString() ?? null,
      paymentStatus: failedPayments > 0 ? "FAILED" : pendingPayments > 0 ? "PENDING" : paid > 0 ? "PAID" : "NONE",
    };
  });

  const allInvoices = await prisma.invoice.findMany({ select: { total: true, amountPaid: true, outstandingBalance: true, status: true } });
  const allPayments = await prisma.payment.findMany({ select: { amount: true, status: true, refundedAmount: true } });

  res.json({
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    summary: {
      totalInvoiced: allInvoices.reduce((s, i) => s + Number(i.total), 0).toFixed(2),
      totalCollected: allPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0).toFixed(2),
      totalOutstanding: allInvoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.outstandingBalance), 0).toFixed(2),
      totalRefunded: allPayments.reduce((s, p) => s + Number(p.refundedAmount), 0).toFixed(2),
    },
  });
});

// GET /api/v1/dashboard/tenants-detail -- Enhanced tenant list with all metrics
router.get("/tenants-detail", requireSuperAdmin, async (req, res) => {
  const { search, status: statusFilter, subscriptionStatus, page = "1", limit = "20", sort = "name", order = "asc" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.TenantWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { orgId: { contains: String(search), mode: "insensitive" } },
    ];
  }
  if (statusFilter) where.status = String(statusFilter);

  const tenants = await prisma.tenant.findMany({
    where,
    include: {
      subscription: true,
      contacts: { where: { isPrimary: true }, take: 1 },
      invoices: { select: { total: true, amountPaid: true, outstandingBalance: true } },
      payments: { select: { amount: true, status: true, paidAt: true }, orderBy: { paidAt: "desc" }, take: 1 },
      _count: { select: { assets: true } },
    },
    skip,
    take: Number(limit),
    orderBy: { [String(sort)]: String(order) },
  });
  const total = await prisma.tenant.count({ where });

  const items = await Promise.all(tenants.map(async (t) => {
    const execTotal = await prisma.procedureExecution.count({ where: { tenantId: t.id } });
    const execBillable = await prisma.procedureExecution.count({ where: { tenantId: t.id, isBillable: true } });
    const invoiced = t.invoices.reduce((s, i) => s + Number(i.total), 0);
    const paid = t.invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const outstanding = t.invoices.reduce((s, i) => s + Number(i.outstandingBalance), 0);

    return {
      id: t.id,
      orgId: t.orgId,
      name: t.name,
      industry: t.industry,
      country: t.country,
      status: t.status,
      health: t.health,
      subscription: t.subscription ? {
        plan: t.subscription.plan,
        status: t.subscription.status,
        model: t.subscription.subscriptionModel,
        startDate: t.subscription.startDate.toISOString(),
        endDate: t.subscription.endDate?.toISOString() ?? null,
        trialEndsAt: t.subscription.trialEndsAt?.toISOString() ?? null,
        renewalDate: t.subscription.renewalDate?.toISOString() ?? null,
        billingCycle: t.subscription.billingCycle,
        monthlyRate: Number(t.subscription.monthlyRate).toFixed(2),
        currency: t.subscription.currency,
      } : null,
      primaryContact: t.contacts[0] ? { name: t.contacts[0].name, email: t.contacts[0].email } : null,
      procedures: { total: execTotal, billable: execBillable },
      billing: { invoiced: invoiced.toFixed(2), paid: paid.toFixed(2), outstanding: outstanding.toFixed(2) },
      lastPaymentDate: t.payments[0]?.paidAt?.toISOString() ?? null,
      lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      assetCount: t._count.assets,
      seatsUsed: t.seatsUsed,
      seatLimit: t.seatLimit,
      createdAt: t.createdAt.toISOString(),
    };
  }));

  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

// GET /api/v1/dashboard/tenant/:id/full -- Complete tenant detail with all sections
router.get("/tenant/:id/full", requireSuperAdmin, async (req, res) => {
  const t = await prisma.tenant.findUnique({
    where: { id: req.params.id },
    include: {
      contacts: true,
      subscription: true,
      hierarchyLevels: { orderBy: { levelOrder: "asc" } },
    },
  });
  if (!t) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }

  const now = new Date();
  const DAY_MS = 86400000;
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    executions, billable, failed, cancelled,
    currentPeriodUsage, previousPeriodUsage,
    memberships, assetCount, invoices, payments, pricingConfigs, auditLogs,
    categoryExecs,
  ] = await Promise.all([
    prisma.procedureExecution.count({ where: { tenantId: t.id } }),
    prisma.procedureExecution.count({ where: { tenantId: t.id, isBillable: true } }),
    prisma.procedureExecution.count({ where: { tenantId: t.id, status: "FAILED" } }),
    prisma.procedureExecution.count({ where: { tenantId: t.id, status: "CANCELLED" } }),
    prisma.procedureExecution.count({ where: { tenantId: t.id, startedAt: { gte: currentMonthStart } } }),
    prisma.procedureExecution.count({ where: { tenantId: t.id, startedAt: { gte: previousMonthStart, lt: currentMonthStart } } }),
    prisma.tenantMembership.findMany({ where: { tenantId: t.id }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true } }, role: { select: { key: true, displayName: true } } } }),
    prisma.asset.count({ where: { tenantId: t.id } }),
    prisma.invoice.findMany({ where: { tenantId: t.id }, include: { items: true }, orderBy: { createdAt: "desc" } }),
    prisma.payment.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: "desc" } }),
    prisma.tenantProcedurePricing.findMany({ where: { tenantId: t.id }, include: { tiers: { orderBy: { tierOrder: "asc" } }, category: true }, orderBy: { effectiveFrom: "desc" } }),
    prisma.auditLog.findMany({ where: { tenantId: t.id }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.procedureExecution.groupBy({ by: ["categoryId"], where: { tenantId: t.id }, _count: { id: true } }),
  ]);

  const billableByCat = await prisma.procedureExecution.groupBy({ by: ["categoryId"], where: { tenantId: t.id, isBillable: true }, _count: { id: true } });
  const allCategories = await prisma.procedureCategory.findMany();
  const catMap = Object.fromEntries(allCategories.map((c) => [c.id, c]));
  const billableCatMap = Object.fromEntries(billableByCat.map((b) => [b.categoryId, b._count.id]));

  const usageByCategory = categoryExecs.map((ce) => ({
    categoryKey: catMap[ce.categoryId]?.key ?? "UNKNOWN",
    categoryName: catMap[ce.categoryId]?.displayName ?? "Unknown",
    total: ce._count.id,
    billable: billableCatMap[ce.categoryId] ?? 0,
  }));

  // Allowance calculations
  const includedAllowance = t.subscription?.includedAllowance ?? null;
  const additionalUsed = includedAllowance != null ? Math.max(0, billable - includedAllowance) : 0;
  const remainingIncluded = includedAllowance != null ? Math.max(0, includedAllowance - billable) : null;

  // Additional charge calculation from active pricing config
  const activeConfig = pricingConfigs.find((c) => c.status === "ACTIVE");
  let additionalCharges: { applicableRate: string | null; additionalQuantity: number; estimatedAmount: string; breakdown: { tierOrder: number; min: number; max: number | null; quantity: number; rate: string; amount: string }[] } | null = null;
  if (activeConfig && activeConfig.tiers.length > 0 && additionalUsed > 0) {
    const breakdown: { tierOrder: number; min: number; max: number | null; quantity: number; rate: string; amount: string }[] = [];
    let remaining = additionalUsed;
    let totalAmount = 0;
    for (const tier of activeConfig.tiers) {
      if (remaining <= 0) break;
      const tierMax = tier.maximumQuantity;
      const tierRange = tierMax != null ? (tierMax - tier.minimumQuantity + 1) : remaining;
      const qty = Math.min(remaining, tierRange);
      const rate = Number(tier.unitRate);
      const amount = qty * rate;
      breakdown.push({ tierOrder: tier.tierOrder, min: tier.minimumQuantity, max: tier.maximumQuantity, quantity: qty, rate: rate.toFixed(2), amount: amount.toFixed(2) });
      totalAmount += amount;
      remaining -= qty;
    }
    const lastTier = activeConfig.tiers[activeConfig.tiers.length - 1];
    additionalCharges = {
      applicableRate: Number(lastTier.unitRate).toFixed(2),
      additionalQuantity: additionalUsed,
      estimatedAmount: totalAmount.toFixed(2),
      breakdown,
    };
  }

  // Financial aggregates
  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const totalOutstanding = invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.outstandingBalance), 0);
  const totalRefunded = payments.reduce((s, p) => s + Number(p.refundedAmount), 0);
  const pendingPayments = payments.filter((p) => p.status === "PENDING").length;
  const failedPayments = payments.filter((p) => p.status === "FAILED").length;
  const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE").length;
  const lastInvoiceDate = invoices.length > 0 ? invoices[0].createdAt.toISOString() : null;

  // Subscription calculations
  const sub = t.subscription;
  let subActiveDays: number | null = null;
  let subRemainingDays: number | null = null;
  let subTotalDays: number | null = null;
  let nextBillingDate: string | null = null;
  let daysSinceExpiry: number | null = null;

  if (sub) {
    const startMs = sub.startDate.getTime();
    subActiveDays = Math.floor((now.getTime() - startMs) / DAY_MS);
    const endMs = sub.endDate?.getTime() ?? sub.trialEndsAt?.getTime() ?? null;
    if (endMs) {
      subTotalDays = Math.ceil((endMs - startMs) / DAY_MS);
      subRemainingDays = Math.max(0, Math.ceil((endMs - now.getTime()) / DAY_MS));
      if (endMs < now.getTime()) {
        daysSinceExpiry = Math.floor((now.getTime() - endMs) / DAY_MS);
      }
    }
    if (sub.renewalDate) {
      nextBillingDate = sub.renewalDate.toISOString();
    } else if (endMs) {
      nextBillingDate = new Date(endMs).toISOString();
    }
  }

  // Overview active days
  const activeSince = t.activatedAt ?? t.createdAt;
  const activeDays = Math.floor((now.getTime() - activeSince.getTime()) / DAY_MS);

  res.json({
    overview: {
      id: t.id, orgId: t.orgId, orgCode: t.orgCode, name: t.name, industry: t.industry,
      country: t.country, state: t.state, city: t.city, address: t.address, postalCode: t.postalCode,
      website: t.website,
      status: t.status, health: t.health, seatLimit: t.seatLimit, seatsUsed: t.seatsUsed,
      activeUsers30d: t.activeUsers30d, lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      billingTimezone: t.billingTimezone, paymentTermsDays: t.paymentTermsDays,
      activatedAt: t.activatedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
      activeDays, daysSinceExpiry,
    },
    contacts: t.contacts.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, role: c.role,
      designation: c.designation, contactType: c.contactType,
      isPrimary: c.isPrimary,
    })),
    subscription: sub ? {
      id: sub.id, plan: sub.plan, status: sub.status, subscriptionModel: sub.subscriptionModel,
      monthlyRate: Number(sub.monthlyRate).toFixed(2),
      previousMonthlyRate: sub.previousMonthlyRate ? Number(sub.previousMonthlyRate).toFixed(2) : null,
      includedAllowance: sub.includedAllowance, currency: sub.currency,
      billingCycle: sub.billingCycle, autoRenew: sub.autoRenew,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate?.toISOString() ?? null,
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      renewalDate: sub.renewalDate?.toISOString() ?? null,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      cancellationReason: sub.cancellationReason,
      previousPlan: sub.previousPlan,
      planChangedAt: sub.planChangedAt?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(), updatedAt: sub.updatedAt.toISOString(),
      activeDays: subActiveDays, remainingDays: subRemainingDays, totalDays: subTotalDays,
      nextBillingDate,
    } : null,
    usage: {
      total: executions, billable, nonBillable: executions - billable,
      failed, cancelled, completed: executions - failed - cancelled,
      includedAllowance, additionalUsed, remainingIncluded,
      currentPeriodUsage, previousPeriodUsage,
      usageByCategory,
      additionalCharges,
    },
    users: memberships.map((m) => ({
      userId: m.user.id, email: m.user.email, firstName: m.user.firstName, lastName: m.user.lastName,
      isActive: m.user.isActive && m.isActive, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      role: m.role.displayName, roleKey: m.role.key,
    })),
    assetCount,
    hierarchyLevels: t.hierarchyLevels,
    pricing: pricingConfigs.map((c) => ({
      id: c.id, categoryName: c.category?.displayName ?? "All procedures",
      pricingModel: c.pricingModel, billingPeriod: c.billingPeriod, currency: c.currency,
      effectiveFrom: c.effectiveFrom.toISOString(), effectiveTo: c.effectiveTo?.toISOString() ?? null,
      status: c.status, version: c.version,
      tiers: c.tiers.map((tier) => ({
        tierOrder: tier.tierOrder, minimumQuantity: tier.minimumQuantity,
        maximumQuantity: tier.maximumQuantity, unitRate: Number(tier.unitRate).toFixed(6),
      })),
    })),
    billing: {
      totalInvoiced: totalInvoiced.toFixed(2), totalPaid: totalPaid.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2), totalRefunded: totalRefunded.toFixed(2),
      pendingPayments, failedPayments, overdueInvoices,
      lastInvoiceDate, nextBillingDate,
      invoices: invoices.map((inv) => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status,
        billingPeriodStart: inv.billingPeriodStart.toISOString(), billingPeriodEnd: inv.billingPeriodEnd.toISOString(),
        currency: inv.currency, total: Number(inv.total).toFixed(2),
        amountPaid: Number(inv.amountPaid).toFixed(2), outstanding: Number(inv.outstandingBalance).toFixed(2),
        dueDate: inv.dueDate.toISOString(), createdAt: inv.createdAt.toISOString(),
        itemCount: inv.items.length,
      })),
    },
    payments: payments.map((p) => ({
      id: p.id, invoiceNumber: p.invoiceNumber, amount: Number(p.amount).toFixed(2), currency: p.currency,
      status: p.status, paymentMethod: p.paymentMethod, transactionId: p.transactionId,
      paidAt: p.paidAt?.toISOString() ?? null, failedAt: p.failedAt?.toISOString() ?? null,
      refundedAmount: Number(p.refundedAmount).toFixed(2), createdAt: p.createdAt.toISOString(),
    })),
    auditLog: auditLogs.map((a) => ({
      id: a.id, action: a.action, entityType: a.entityType, entityId: a.entityId,
      reason: a.reason,
      before: a.before, after: a.after,
      performedBy: a.user ? { userId: a.user.id, email: a.user.email, firstName: a.user.firstName, lastName: a.user.lastName } : null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

// PUT /api/v1/dashboard/tenant/:id -- Update tenant information
router.put("/tenant/:id", requireSuperAdmin, async (req, res) => {
  const t = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!t) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }

  const allowed = ["name", "industry", "country", "state", "city", "address", "postalCode", "website", "orgCode", "billingTimezone", "paymentTermsDays"] as const;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      before[key] = (t as Record<string, unknown>)[key];
      after[key] = req.body[key];
      data[key] = req.body[key];
    }
  }

  if (Object.keys(data).length === 0) { res.status(400).json({ code: "NO_CHANGES", message: "No valid fields provided" }); return; }

  const updated = await prisma.tenant.update({ where: { id: t.id }, data });
  await prisma.auditLog.create({
    data: {
      tenantId: t.id, userId: (req as any).auth?.userId ?? null,
      action: "TENANT_UPDATED", entityType: "tenant", entityId: t.id,
      before, after, reason: `Updated: ${Object.keys(data).join(", ")}`,
    },
  });

  res.json({
    id: updated.id, orgId: updated.orgId, orgCode: updated.orgCode, name: updated.name,
    industry: updated.industry, country: updated.country, state: updated.state, city: updated.city,
    address: updated.address, postalCode: updated.postalCode, website: updated.website,
    status: updated.status, health: updated.health, seatLimit: updated.seatLimit, seatsUsed: updated.seatsUsed,
    billingTimezone: updated.billingTimezone, paymentTermsDays: updated.paymentTermsDays,
    activatedAt: updated.activatedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(),
  });
});

// POST /api/v1/dashboard/tenant/:id/subscription/action -- Subscription lifecycle actions
router.post("/tenant/:id/subscription/action", requireSuperAdmin, async (req, res) => {
  const t = await prisma.tenant.findUnique({ where: { id: req.params.id }, include: { subscription: true } });
  if (!t) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  if (!t.subscription) { res.status(404).json({ code: "NO_SUBSCRIPTION", message: "Tenant has no subscription" }); return; }

  const { action, reason, extendDays } = req.body as { action: string; reason?: string; extendDays?: number };
  const sub = t.subscription;
  const now = new Date();
  const DAY_MS = 86400000;

  let updateData: Record<string, unknown> = {};
  let auditAction = "";

  switch (action) {
    case "RENEW": {
      const cycle = sub.billingCycle;
      const base = sub.endDate ?? now;
      let newEnd: Date;
      if (cycle === "ANNUAL") newEnd = new Date(base.getTime() + 365 * DAY_MS);
      else if (cycle === "QUARTERLY") newEnd = new Date(base.getTime() + 90 * DAY_MS);
      else newEnd = new Date(base.getTime() + 30 * DAY_MS);
      updateData = { status: "ACTIVE", endDate: newEnd, renewalDate: newEnd };
      auditAction = "SUBSCRIPTION_RENEWED";
      break;
    }
    case "EXTEND": {
      const days = extendDays ?? 30;
      const base = sub.endDate ?? now;
      const newEnd = new Date(base.getTime() + days * DAY_MS);
      updateData = { endDate: newEnd };
      if (sub.trialEndsAt) updateData.trialEndsAt = newEnd;
      auditAction = "SUBSCRIPTION_EXTENDED";
      break;
    }
    case "SUSPEND":
      updateData = { status: "SUSPENDED", cancelledAt: now };
      auditAction = "SUBSCRIPTION_SUSPENDED";
      break;
    case "REACTIVATE":
      updateData = { status: "ACTIVE", cancelledAt: null, cancellationReason: null };
      auditAction = "SUBSCRIPTION_REACTIVATED";
      break;
    case "CANCEL":
      updateData = { status: "CANCELLED", cancelledAt: now, cancellationReason: reason ?? null, autoRenew: false };
      auditAction = "SUBSCRIPTION_CANCELLED";
      break;
    default:
      res.status(400).json({ code: "INVALID_ACTION", message: `Unknown action: ${action}` }); return;
  }

  const updated = await prisma.subscription.update({ where: { id: sub.id }, data: updateData });
  await prisma.auditLog.create({
    data: {
      tenantId: t.id, userId: (req as any).auth?.userId ?? null,
      action: auditAction, entityType: "subscription", entityId: sub.id,
      before: { status: sub.status, endDate: sub.endDate?.toISOString() ?? null },
      after: updateData,
      reason: reason ?? `${action} performed`,
    },
  });

  res.json({
    id: updated.id, plan: updated.plan, status: updated.status, subscriptionModel: updated.subscriptionModel,
    monthlyRate: Number(updated.monthlyRate).toFixed(2), currency: updated.currency,
    billingCycle: updated.billingCycle, autoRenew: updated.autoRenew,
    includedAllowance: updated.includedAllowance,
    startDate: updated.startDate.toISOString(),
    endDate: updated.endDate?.toISOString() ?? null,
    trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
    renewalDate: updated.renewalDate?.toISOString() ?? null,
    cancelledAt: updated.cancelledAt?.toISOString() ?? null,
    cancellationReason: updated.cancellationReason,
    createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(),
  });
});

// GET /api/v1/dashboard/users-summary -- All users across tenants
router.get("/users-summary", requireSuperAdmin, async (req, res) => {
  const { search, status, tenantId, role, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const userWhere: Prisma.UserWhereInput = {};
  if (search) {
    userWhere.OR = [
      { email: { contains: String(search), mode: "insensitive" } },
      { firstName: { contains: String(search), mode: "insensitive" } },
      { lastName: { contains: String(search), mode: "insensitive" } },
    ];
  }
  if (status === "ACTIVE") userWhere.isActive = true;
  else if (status === "INACTIVE") userWhere.isActive = false;

  const memWhere: Prisma.TenantMembershipWhereInput = {};
  if (tenantId) memWhere.tenantId = String(tenantId);
  if (role) memWhere.role = { key: String(role) };

  const [totalUsers, activeUsers, inactiveUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
  ]);

  const roleGroups = await prisma.tenantMembership.groupBy({
    by: ["roleId"],
    _count: { id: true },
  });
  const allRoles = await prisma.role.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.id, r]));
  const byRole = roleGroups.map((g) => ({
    role: roleMap[g.roleId]?.displayName ?? "Unknown",
    roleKey: roleMap[g.roleId]?.key ?? "UNKNOWN",
    count: g._count.id,
  }));

  const memberships = await prisma.tenantMembership.findMany({
    where: { ...memWhere, user: userWhere },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true } },
      tenant: { select: { id: true, name: true, orgId: true } },
      role: { select: { key: true, displayName: true } },
    },
    skip,
    take: Number(limit),
    orderBy: { createdAt: "desc" },
  });
  const total = await prisma.tenantMembership.count({ where: { ...memWhere, user: userWhere } });

  res.json({
    summary: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, byRole },
    items: memberships.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      isActive: m.user.isActive,
      lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null,
      tenantId: m.tenant.id,
      tenantName: m.tenant.name,
      tenantOrgId: m.tenant.orgId,
      role: m.role.displayName,
      roleKey: m.role.key,
      createdAt: m.user.createdAt.toISOString(),
    })),
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/v1/dashboard/procedures-summary -- Procedure executions across tenants
router.get("/procedures-summary", requireSuperAdmin, async (req, res) => {
  const { search, tenantId, categoryId, status, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const execWhere: Prisma.ProcedureExecutionWhereInput = {};
  if (tenantId) execWhere.tenantId = String(tenantId);
  if (categoryId) execWhere.categoryId = String(categoryId);
  if (status) execWhere.status = String(status);
  if (search) execWhere.tenant = { name: { contains: String(search), mode: "insensitive" } };

  const [total, completed, failed, cancelled, pending, billable] = await Promise.all([
    prisma.procedureExecution.count({ where: execWhere }),
    prisma.procedureExecution.count({ where: { ...execWhere, status: "COMPLETED" } }),
    prisma.procedureExecution.count({ where: { ...execWhere, status: "FAILED" } }),
    prisma.procedureExecution.count({ where: { ...execWhere, status: "CANCELLED" } }),
    prisma.procedureExecution.count({ where: { ...execWhere, status: "PENDING" } }),
    prisma.procedureExecution.count({ where: { ...execWhere, isBillable: true } }),
  ]);

  // By tenant
  const tenantGroups = await prisma.procedureExecution.groupBy({ by: ["tenantId"], where: execWhere, _count: { id: true } });
  const billableByTenant = await prisma.procedureExecution.groupBy({ by: ["tenantId"], where: { ...execWhere, isBillable: true }, _count: { id: true } });
  const billableTMap = Object.fromEntries(billableByTenant.map((b) => [b.tenantId, b._count.id]));
  const tenantIds = tenantGroups.map((g) => g.tenantId);
  const tenantsForExec = await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, orgId: true } });
  const tMap = Object.fromEntries(tenantsForExec.map((t) => [t.id, t]));
  const byTenant = tenantGroups.map((g) => ({
    tenantId: g.tenantId,
    tenantName: tMap[g.tenantId]?.name ?? "Unknown",
    orgId: tMap[g.tenantId]?.orgId ?? "",
    total: g._count.id,
    billable: billableTMap[g.tenantId] ?? 0,
    nonBillable: g._count.id - (billableTMap[g.tenantId] ?? 0),
  })).sort((a, b) => b.total - a.total);

  // By category
  const catGroups = await prisma.procedureExecution.groupBy({ by: ["categoryId"], where: execWhere, _count: { id: true } });
  const billableByCat = await prisma.procedureExecution.groupBy({ by: ["categoryId"], where: { ...execWhere, isBillable: true }, _count: { id: true } });
  const billableCMap = Object.fromEntries(billableByCat.map((b) => [b.categoryId, b._count.id]));
  const allCats = await prisma.procedureCategory.findMany();
  const cMap = Object.fromEntries(allCats.map((c) => [c.id, c]));
  const byCategory = catGroups.map((g) => ({
    categoryId: g.categoryId,
    categoryName: cMap[g.categoryId]?.displayName ?? "Unknown",
    categoryKey: cMap[g.categoryId]?.key ?? "UNKNOWN",
    total: g._count.id,
    billable: billableCMap[g.categoryId] ?? 0,
  })).sort((a, b) => b.total - a.total);

  // Paginated items
  const executions = await prisma.procedureExecution.findMany({
    where: execWhere,
    include: {
      tenant: { select: { name: true, orgId: true } },
      user: { select: { email: true, firstName: true, lastName: true } },
      category: { select: { displayName: true } },
    },
    skip,
    take: Number(limit),
    orderBy: { startedAt: "desc" },
  });

  res.json({
    summary: { total, completed, failed, cancelled, pending, billable, nonBillable: total - billable },
    byTenant,
    byCategory,
    items: executions.map((e) => ({
      id: e.id,
      tenantName: e.tenant.name,
      tenantOrgId: e.tenant.orgId,
      userName: [e.user.firstName, e.user.lastName].filter(Boolean).join(" ") || e.user.email,
      categoryName: e.category.displayName,
      status: e.status,
      isBillable: e.isBillable,
      quantity: e.quantity,
      amount: e.amount ? Number(e.amount).toFixed(2) : null,
      startedAt: e.startedAt.toISOString(),
      completedAt: e.completedAt?.toISOString() ?? null,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/v1/dashboard/payments-detail -- All payment transactions
router.get("/payments-detail", requireSuperAdmin, async (req, res) => {
  const { search, status, tenantId, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = String(status);
  if (tenantId) where.tenantId = String(tenantId);
  if (search) where.tenant = { name: { contains: String(search), mode: "insensitive" } };

  const allPayments = await prisma.payment.findMany({ select: { amount: true, status: true, refundedAmount: true, paymentMethod: true, tenantId: true } });
  const collected = allPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const pendingAmt = allPayments.filter((p) => p.status === "PENDING").reduce((s, p) => s + Number(p.amount), 0);
  const failedAmt = allPayments.filter((p) => p.status === "FAILED").reduce((s, p) => s + Number(p.amount), 0);
  const refunded = allPayments.reduce((s, p) => s + Number(p.refundedAmount), 0);
  const payingTenantIds = new Set(allPayments.filter((p) => p.status === "PAID").map((p) => p.tenantId));

  const methodFreq: Record<string, { count: number; total: number }> = {};
  for (const p of allPayments.filter((p) => p.status === "PAID")) {
    const m = p.paymentMethod ?? "Unknown";
    if (!methodFreq[m]) methodFreq[m] = { count: 0, total: 0 };
    methodFreq[m].count++;
    methodFreq[m].total += Number(p.amount);
  }
  const byMethod = Object.entries(methodFreq).map(([method, v]) => ({ method, count: v.count, total: v.total.toFixed(2) }));

  const payments = await prisma.payment.findMany({
    where,
    include: { tenant: { select: { name: true, orgId: true } } },
    skip,
    take: Number(limit),
    orderBy: { createdAt: "desc" },
  });
  const total = await prisma.payment.count({ where });

  res.json({
    summary: {
      totalCollected: collected.toFixed(2),
      totalPending: pendingAmt.toFixed(2),
      totalFailed: failedAmt.toFixed(2),
      totalRefunded: refunded.toFixed(2),
      transactionCount: allPayments.length,
      payingTenants: payingTenantIds.size,
      byMethod,
    },
    items: payments.map((p) => ({
      id: p.id,
      tenantName: p.tenant.name,
      tenantOrgId: p.tenant.orgId,
      invoiceNumber: p.invoiceNumber,
      amount: Number(p.amount).toFixed(2),
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      transactionId: p.transactionId,
      paidAt: p.paidAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
      refundedAmount: Number(p.refundedAmount).toFixed(2),
      createdAt: p.createdAt.toISOString(),
    })),
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/v1/dashboard/outstanding-detail -- Outstanding invoices
router.get("/outstanding-detail", requireSuperAdmin, async (req, res) => {
  const { search, page = "1", limit = "20" } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: Prisma.InvoiceWhereInput = { status: { in: ["OPEN", "OVERDUE"] } };
  if (search) where.tenant = { name: { contains: String(search), mode: "insensitive" } };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { tenant: { select: { name: true, orgId: true } } },
    skip,
    take: Number(limit),
    orderBy: { dueDate: "asc" },
  });
  const total = await prisma.invoice.count({ where });
  const now = new Date();
  const DAY_MS = 86400000;

  const totalOutstanding = await prisma.invoice.aggregate({ where, _sum: { outstandingBalance: true } });

  res.json({
    summary: {
      totalOutstanding: Number(totalOutstanding._sum.outstandingBalance ?? 0).toFixed(2),
      count: total,
    },
    items: invoices.map((inv) => {
      const overdueDays = inv.dueDate < now ? Math.floor((now.getTime() - inv.dueDate.getTime()) / DAY_MS) : 0;
      return {
        id: inv.id,
        tenantName: inv.tenant.name,
        tenantOrgId: inv.tenant.orgId,
        invoiceNumber: inv.invoiceNumber,
        billingPeriodStart: inv.billingPeriodStart.toISOString(),
        billingPeriodEnd: inv.billingPeriodEnd.toISOString(),
        currency: inv.currency,
        total: Number(inv.total).toFixed(2),
        amountPaid: Number(inv.amountPaid).toFixed(2),
        outstanding: Number(inv.outstandingBalance).toFixed(2),
        status: inv.status,
        dueDate: inv.dueDate.toISOString(),
        overdueDays,
        createdAt: inv.createdAt.toISOString(),
      };
    }),
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// GET /api/v1/dashboard/subscriptions-expiry -- Subscription monitoring
router.get("/subscriptions-expiry", requireSuperAdmin, async (_req, res) => {
  const subs = await prisma.subscription.findMany({
    include: { tenant: { select: { id: true, orgId: true, name: true } } },
    orderBy: { endDate: "asc" },
  });

  const now = new Date();
  const items = subs.map((s) => {
    const startMs = s.startDate.getTime();
    const endMs = s.endDate?.getTime() ?? (s.trialEndsAt?.getTime() ?? startMs + 365 * 24 * 60 * 60 * 1000);
    const totalDuration = endMs - startMs;
    const elapsed = now.getTime() - startMs;
    const remaining = Math.max(0, endMs - now.getTime());
    const remainingDays = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    const progress = totalDuration > 0 ? Math.min(1, Math.max(0, elapsed / totalDuration)) : 1;

    let expiryStatus = "ACTIVE";
    if (s.status === "EXPIRED" || (s.endDate && s.endDate < now)) expiryStatus = "EXPIRED";
    else if (remainingDays <= 30 && remainingDays > 0) expiryStatus = "EXPIRING_SOON";
    else if (s.status !== "ACTIVE" && s.status !== "TRIAL") expiryStatus = "INACTIVE";

    return {
      tenantId: s.tenant.id, orgId: s.tenant.orgId, tenantName: s.tenant.name,
      plan: s.plan, status: s.status, expiryStatus,
      startDate: s.startDate.toISOString(), endDate: s.endDate?.toISOString() ?? null,
      trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
      renewalDate: s.renewalDate?.toISOString() ?? null,
      billingCycle: s.billingCycle, monthlyRate: Number(s.monthlyRate).toFixed(2), currency: s.currency,
      autoRenew: s.autoRenew, progress: Math.round(progress * 100),
      remainingDays, totalDurationDays: Math.ceil(totalDuration / (24 * 60 * 60 * 1000)),
    };
  });

  res.json({ items });
});

export default router;
