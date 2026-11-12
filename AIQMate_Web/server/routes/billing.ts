import { PrismaClient, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin, requireTenant } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { priceUsage, type PricingConfig, type PricingSlab } from "../services/pricing";

const prisma = new PrismaClient();
const router = Router();

const calculateSchema = z.object({
  tenantId: z.string().uuid(),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
  categoryId: z.string().uuid().optional(),
});

const generateInvoiceSchema = z.object({
  tenantId: z.string().uuid(),
  billingPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM format"),
  categoryId: z.string().uuid().optional(),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.string().or(z.number()),
  paymentMethod: z.string().min(1),
  transactionId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helper: resolve pricing config + count billable executions + calculate
// ---------------------------------------------------------------------------

async function calculateBilling(tenantId: string, billingPeriod: string, categoryId?: string) {
  const now = new Date();
  const pricingWhere: Record<string, unknown> = {
    tenantId,
    status: "ACTIVE",
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
  };
  if (categoryId) {
    pricingWhere.categoryId = categoryId;
  } else {
    pricingWhere.pricingScope = "ALL";
  }

  const pricingConfig = await prisma.tenantProcedurePricing.findFirst({
    where: pricingWhere,
    include: { tiers: { orderBy: { tierOrder: "asc" } } },
  });

  if (!pricingConfig) {
    return { error: "PRICING_NOT_CONFIGURED", message: "No active pricing configuration found for this tenant and scope" };
  }

  const execWhere: Record<string, unknown> = {
    tenantId,
    billingPeriod,
    isBillable: true,
  };
  if (categoryId) execWhere.categoryId = categoryId;

  const billableCount = await prisma.procedureExecution.count({ where: execWhere });

  const slabs: PricingSlab[] = pricingConfig.tiers.map((t) => ({
    slabMin: t.minimumQuantity,
    slabMax: t.maximumQuantity,
    unitRate: t.unitRate.toString(),
    tierOrder: t.tierOrder,
  }));

  const config: PricingConfig = {
    model: pricingConfig.pricingModel as "GRADUATED" | "VOLUME",
    currency: pricingConfig.currency,
    slabs,
  };

  const result = priceUsage(config, billableCount);

  return {
    tenantId,
    billingPeriod,
    categoryId: categoryId ?? null,
    pricingConfigId: pricingConfig.id,
    pricingModel: pricingConfig.pricingModel,
    currency: pricingConfig.currency,
    billableCount,
    calculation: result,
    pricingSnapshot: {
      configId: pricingConfig.id,
      model: pricingConfig.pricingModel,
      tiers: pricingConfig.tiers.map((t) => ({
        min: t.minimumQuantity,
        max: t.maximumQuantity,
        rate: t.unitRate.toString(),
        order: t.tierOrder,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/billing/calculate
// ---------------------------------------------------------------------------

router.post("/calculate", requireSuperAdmin, async (req, res) => {
  const parsed = calculateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") });
    return;
  }

  try {
    const result = await calculateBilling(parsed.data.tenantId, parsed.data.billingPeriod, parsed.data.categoryId);
    if ("error" in result) {
      res.status(400).json({ code: result.error, message: result.message });
      return;
    }
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Calculation failed";
    res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: msg });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/generate-invoice
// ---------------------------------------------------------------------------

router.post("/generate-invoice", requireSuperAdmin, async (req, res) => {
  const parsed = generateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") });
    return;
  }

  const { tenantId, billingPeriod, categoryId } = parsed.data;

  const [yearStr, monthStr] = billingPeriod.split("-");
  const periodStart = new Date(`${yearStr}-${monthStr}-01T00:00:00Z`);
  const periodEnd = new Date(periodStart);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  periodEnd.setUTCMilliseconds(-1);

  const existingInvoice = await prisma.invoice.findFirst({
    where: { tenantId, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd },
  });
  if (existingInvoice) {
    res.status(409).json({ code: "DUPLICATE_INVOICE", message: `Invoice already exists for ${billingPeriod}: ${existingInvoice.invoiceNumber}` });
    return;
  }

  let billingResult;
  try {
    billingResult = await calculateBilling(tenantId, billingPeriod, categoryId);
    if ("error" in billingResult) {
      res.status(400).json({ code: billingResult.error, message: billingResult.message });
      return;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Calculation failed";
    res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: msg });
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" });
    return;
  }

  const dueDate = new Date(periodEnd);
  dueDate.setUTCDate(dueDate.getUTCDate() + (tenant.paymentTermsDays ?? 30));

  const invoiceCount = await prisma.invoice.count();
  const invoiceNumber = `INV-${yearStr}-${String(invoiceCount + 1).padStart(5, "0")}`;

  const subtotal = new Decimal(billingResult.calculation.subtotal);
  const taxAmount = new Decimal(0);
  const total = subtotal.plus(taxAmount);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        currency: billingResult.currency,
        subtotal: new Prisma.Decimal(subtotal.toFixed(6)),
        taxRate: null,
        taxAmount: new Prisma.Decimal("0"),
        discountAmount: new Prisma.Decimal("0"),
        adjustmentAmount: new Prisma.Decimal("0"),
        total: new Prisma.Decimal(total.toFixed(6)),
        amountPaid: new Prisma.Decimal("0"),
        outstandingBalance: new Prisma.Decimal(total.toFixed(6)),
        status: "OPEN",
        dueDate,
        createdBy: req.auth?.userId,
      },
    });

    for (const line of billingResult.calculation.lines) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: inv.id,
          categoryId: billingResult.categoryId,
          description: `${billingResult.pricingModel} pricing: ${line.qty} procedures @ ${line.unitRate}/${billingResult.currency}`,
          pricingModel: billingResult.pricingModel,
          pricingConfigId: billingResult.pricingConfigId,
          pricingSnapshot: billingResult.pricingSnapshot as object,
          quantity: line.qty,
          unitRate: new Prisma.Decimal(line.unitRate),
          amount: new Prisma.Decimal(line.amount),
          tierMin: line.slabMin,
          tierMax: line.slabMax,
          tierOrder: billingResult.calculation.lines.indexOf(line) + 1,
        },
      });
    }

    return tx.invoice.findUnique({
      where: { id: inv.id },
      include: { items: { orderBy: { tierOrder: "asc" } } },
    });
  });

  await logAudit({
    tenantId,
    userId: req.auth?.userId,
    action: "INVOICE_GENERATED",
    entityType: "Invoice",
    entityId: invoice?.id,
    after: { invoiceNumber, billingPeriod, total: total.toFixed(2) },
  });

  res.status(201).json(invoice);
});

// ---------------------------------------------------------------------------
// GET /api/v1/invoices
// ---------------------------------------------------------------------------

router.get("/invoices", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  let tenantId: string | undefined;
  if (req.auth?.isSuperAdmin) {
    tenantId = (req.query.tenantId as string) || undefined;
  } else {
    if (!req.auth?.tenantId) { res.status(400).json({ code: "TENANT_NOT_FOUND", message: "Tenant context required" }); return; }
    tenantId = req.auth.tenantId;
  }

  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;
  if (req.query.status) where.status = req.query.status;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { items: { orderBy: { tierOrder: "asc" } }, tenant: { select: { id: true, orgId: true, name: true } } } }),
    prisma.invoice.count({ where }),
  ]);

  res.json({ items, total, page, limit });
});

// ---------------------------------------------------------------------------
// GET /api/v1/invoices/:id
// ---------------------------------------------------------------------------

router.get("/invoices/:id", async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { items: { orderBy: { tierOrder: "asc" } }, payments: { orderBy: { createdAt: "desc" } }, tenant: { select: { id: true, orgId: true, name: true } } },
  });

  if (!invoice) { res.status(404).json({ code: "NOT_FOUND", message: "Invoice not found" }); return; }
  if (!req.auth?.isSuperAdmin && invoice.tenantId !== req.auth?.tenantId) {
    res.status(403).json({ code: "TENANT_ACCESS_DENIED", message: "Not your tenant" }); return;
  }

  res.json(invoice);
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/invoices/:id/void
// ---------------------------------------------------------------------------

router.patch("/invoices/:id/void", requireSuperAdmin, async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) { res.status(404).json({ code: "NOT_FOUND", message: "Invoice not found" }); return; }

  if (invoice.status !== "OPEN" && invoice.status !== "OVERDUE") {
    res.status(400).json({ code: "INVALID_STATUS", message: `Cannot void an invoice with status ${invoice.status}. Only OPEN or OVERDUE invoices can be voided.` });
    return;
  }

  const updated = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { status: "VOID", voidedAt: new Date() },
    include: { items: true },
  });

  await logAudit({
    tenantId: invoice.tenantId,
    userId: req.auth?.userId,
    action: "INVOICE_VOIDED",
    entityType: "Invoice",
    entityId: invoice.id,
    before: { status: invoice.status },
    after: { status: "VOID" },
  });

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /api/v1/payments
// ---------------------------------------------------------------------------

router.post("/payments", async (req, res) => {
  const parsed = recordPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") });
    return;
  }

  const { invoiceId, amount: rawAmount, paymentMethod, transactionId } = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) { res.status(404).json({ code: "NOT_FOUND", message: "Invoice not found" }); return; }

  if (!req.auth?.isSuperAdmin && invoice.tenantId !== req.auth?.tenantId) {
    res.status(403).json({ code: "TENANT_ACCESS_DENIED", message: "Not your tenant" }); return;
  }

  if (invoice.status === "VOID" || invoice.status === "PAID") {
    res.status(400).json({ code: "INVALID_STATUS", message: `Cannot pay an invoice with status ${invoice.status}` }); return;
  }

  const paymentAmount = new Decimal(String(rawAmount));
  if (paymentAmount.lte(0)) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: "Amount must be positive" }); return;
  }

  const currentPaid = new Decimal(invoice.amountPaid.toString());
  const invoiceTotal = new Decimal(invoice.total.toString());
  const newPaid = currentPaid.plus(paymentAmount);
  const newOutstanding = Decimal.max(invoiceTotal.minus(newPaid), new Decimal(0));
  const fullyPaid = newPaid.gte(invoiceTotal);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: new Prisma.Decimal(paymentAmount.toFixed(6)),
        currency: invoice.currency,
        status: "PAID",
        paymentMethod,
        transactionId: transactionId ?? null,
        paidAt: new Date(),
      },
    });

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: new Prisma.Decimal(newPaid.toFixed(6)),
        outstandingBalance: new Prisma.Decimal(newOutstanding.toFixed(6)),
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        paidAt: fullyPaid ? new Date() : null,
      },
    });

    return { payment, invoice: updatedInvoice };
  });

  await logAudit({
    tenantId: invoice.tenantId,
    userId: req.auth?.userId,
    action: "PAYMENT_RECORDED",
    entityType: "Payment",
    entityId: result.payment.id,
    after: { invoiceId, amount: paymentAmount.toFixed(2), method: paymentMethod, invoiceStatus: result.invoice.status },
  });

  res.status(201).json(result);
});

// ---------------------------------------------------------------------------
// GET /api/v1/payments
// ---------------------------------------------------------------------------

router.get("/payments", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  let tenantId: string | undefined;
  if (req.auth?.isSuperAdmin) {
    tenantId = (req.query.tenantId as string) || undefined;
  } else {
    if (!req.auth?.tenantId) { res.status(400).json({ code: "TENANT_NOT_FOUND", message: "Tenant context required" }); return; }
    tenantId = req.auth.tenantId;
  }

  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;
  if (req.query.invoiceId) where.invoiceId = req.query.invoiceId;
  if (req.query.status) where.status = req.query.status;

  const [items, total] = await Promise.all([
    prisma.payment.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { invoice: { select: { invoiceNumber: true, status: true } }, tenant: { select: { name: true, orgId: true } } } }),
    prisma.payment.count({ where }),
  ]);

  res.json({ items, total, page, limit });
});

export default router;
