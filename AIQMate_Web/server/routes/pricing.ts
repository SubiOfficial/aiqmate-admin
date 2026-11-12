import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin, requireTenant } from "../middleware/auth";
import { logAudit } from "../services/audit";

const prisma = new PrismaClient();
const router = Router();

const tierSchema = z.object({
  minimumQuantity: z.number().int().min(1),
  maximumQuantity: z.number().int().min(1).nullable(),
  unitRate: z.string().or(z.number()),
  tierOrder: z.number().int().min(1),
});

const createConfigSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  pricingScope: z.enum(["ALL", "CATEGORY"]).default("ALL"),
  pricingModel: z.enum(["GRADUATED", "VOLUME"]),
  billingPeriod: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  currency: z.string().min(3).max(3).default("USD"),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE"]).default("DRAFT"),
  tiers: z.array(tierSchema).min(1),
});

const previewSchema = z.object({
  pricingModel: z.enum(["GRADUATED", "VOLUME"]),
  quantity: z.number().int().min(0),
  tiers: z.array(tierSchema).min(1),
  currency: z.string().default("USD"),
});

// GET /api/v1/pricing/configs?tenantId=...
router.get("/configs", requireSuperAdmin, async (req, res) => {
  const tenantId = req.query.tenantId as string;
  if (!tenantId) { res.status(400).json({ code: "MISSING_TENANT_ID", message: "tenantId query param required" }); return; }

  const configs = await prisma.tenantProcedurePricing.findMany({
    where: { tenantId },
    include: { tiers: { orderBy: { tierOrder: "asc" } }, category: true },
    orderBy: { effectiveFrom: "desc" },
  });
  res.json({ items: configs });
});

// GET /api/v1/pricing/configs/:id
router.get("/configs/:id", async (req, res) => {
  const config = await prisma.tenantProcedurePricing.findUnique({
    where: { id: req.params.id },
    include: { tiers: { orderBy: { tierOrder: "asc" } }, category: true },
  });
  if (!config) { res.status(404).json({ code: "NOT_FOUND", message: "Pricing configuration not found" }); return; }
  if (!req.auth?.isSuperAdmin && config.tenantId !== req.auth?.tenantId) {
    res.status(403).json({ code: "TENANT_ACCESS_DENIED", message: "Not your tenant" }); return;
  }
  res.json(config);
});

// POST /api/v1/pricing/configs
router.post("/configs", requireSuperAdmin, async (req, res) => {
  const tenantId = req.body.tenantId as string;
  if (!tenantId) { res.status(400).json({ code: "MISSING_TENANT_ID", message: "tenantId required" }); return; }

  const parsed = createConfigSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") }); return; }
  const data = parsed.data;

  const tiers = data.tiers.sort((a, b) => a.tierOrder - b.tierOrder);
  const tierError = validateTiers(tiers);
  if (tierError) { res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: tierError }); return; }

  if (data.status === "ACTIVE") {
    const overlap = await prisma.tenantProcedurePricing.findFirst({
      where: {
        tenantId,
        categoryId: data.categoryId ?? null,
        status: "ACTIVE",
        effectiveFrom: { lte: new Date(data.effectiveTo ?? "9999-12-31") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date(data.effectiveFrom) } }],
      },
    });
    if (overlap) { res.status(409).json({ code: "PRICING_OVERLAP", message: "An active configuration already covers this period" }); return; }
  }

  const config = await prisma.tenantProcedurePricing.create({
    data: {
      tenantId,
      categoryId: data.categoryId ?? null,
      pricingScope: data.pricingScope,
      pricingModel: data.pricingModel,
      billingPeriod: data.billingPeriod,
      currency: data.currency,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      status: data.status,
      createdBy: req.auth?.userId,
      updatedBy: req.auth?.userId,
      tiers: {
        create: tiers.map((t) => ({
          minimumQuantity: t.minimumQuantity,
          maximumQuantity: t.maximumQuantity,
          unitRate: String(t.unitRate),
          tierOrder: t.tierOrder,
        })),
      },
    },
    include: { tiers: { orderBy: { tierOrder: "asc" } } },
  });

  await logAudit({ tenantId, userId: req.auth?.userId, action: "PRICING_CONFIG_CREATED", entityType: "TenantProcedurePricing", entityId: config.id, after: config });
  res.status(201).json(config);
});

// PUT /api/v1/pricing/configs/:id
router.put("/configs/:id", requireSuperAdmin, async (req, res) => {
  const existing = await prisma.tenantProcedurePricing.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Configuration not found" }); return; }
  if (existing.status === "ACTIVE") { res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: "Cannot edit an active configuration. Deactivate it first or create a new one." }); return; }

  const parsed = createConfigSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") }); return; }
  const data = parsed.data;
  const tiers = data.tiers.sort((a, b) => a.tierOrder - b.tierOrder);
  const tierError = validateTiers(tiers);
  if (tierError) { res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: tierError }); return; }

  await prisma.tenantProcedurePricingTier.deleteMany({ where: { pricingConfigId: req.params.id } });

  const config = await prisma.tenantProcedurePricing.update({
    where: { id: req.params.id },
    data: {
      pricingModel: data.pricingModel,
      billingPeriod: data.billingPeriod,
      currency: data.currency,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      status: data.status,
      version: { increment: 1 },
      updatedBy: req.auth?.userId,
      tiers: {
        create: tiers.map((t) => ({
          minimumQuantity: t.minimumQuantity,
          maximumQuantity: t.maximumQuantity,
          unitRate: String(t.unitRate),
          tierOrder: t.tierOrder,
        })),
      },
    },
    include: { tiers: { orderBy: { tierOrder: "asc" } } },
  });

  await logAudit({ tenantId: existing.tenantId, userId: req.auth?.userId, action: "PRICING_CONFIG_UPDATED", entityType: "TenantProcedurePricing", entityId: config.id, before: existing, after: config });
  res.json(config);
});

// PATCH /api/v1/pricing/configs/:id/activate
router.patch("/configs/:id/activate", requireSuperAdmin, async (req, res) => {
  const existing = await prisma.tenantProcedurePricing.findUnique({ where: { id: req.params.id }, include: { tiers: true } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Configuration not found" }); return; }
  if (existing.tiers.length === 0) { res.status(400).json({ code: "PRICING_CONFIGURATION_INVALID", message: "Add at least one tier before activating" }); return; }

  const overlap = await prisma.tenantProcedurePricing.findFirst({
    where: {
      tenantId: existing.tenantId,
      categoryId: existing.categoryId,
      status: "ACTIVE",
      id: { not: existing.id },
      effectiveFrom: { lte: existing.effectiveTo ?? new Date("9999-12-31") },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: existing.effectiveFrom } }],
    },
  });
  if (overlap) { res.status(409).json({ code: "PRICING_OVERLAP", message: "Deactivate the existing active configuration first" }); return; }

  const config = await prisma.tenantProcedurePricing.update({
    where: { id: req.params.id },
    data: { status: "ACTIVE", updatedBy: req.auth?.userId },
    include: { tiers: { orderBy: { tierOrder: "asc" } } },
  });
  await logAudit({ tenantId: existing.tenantId, userId: req.auth?.userId, action: "PRICING_CONFIG_ACTIVATED", entityType: "TenantProcedurePricing", entityId: config.id });
  res.json(config);
});

// PATCH /api/v1/pricing/configs/:id/deactivate
router.patch("/configs/:id/deactivate", requireSuperAdmin, async (req, res) => {
  const existing = await prisma.tenantProcedurePricing.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Configuration not found" }); return; }

  const config = await prisma.tenantProcedurePricing.update({
    where: { id: req.params.id },
    data: { status: "INACTIVE", updatedBy: req.auth?.userId },
    include: { tiers: { orderBy: { tierOrder: "asc" } } },
  });
  await logAudit({ tenantId: existing.tenantId, userId: req.auth?.userId, action: "PRICING_CONFIG_DEACTIVATED", entityType: "TenantProcedurePricing", entityId: config.id });
  res.json(config);
});

// POST /api/v1/pricing/preview
router.post("/preview", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") }); return; }

  const { pricingModel, quantity, tiers, currency } = parsed.data;

  try {
    const { priceUsage } = await import("../services/pricing");
    const sortedTiers = tiers.sort((a, b) => a.tierOrder - b.tierOrder);
    const config = {
      model: pricingModel as "GRADUATED" | "VOLUME",
      currency,
      slabs: sortedTiers.map((t) => ({
        slabMin: t.minimumQuantity,
        slabMax: t.maximumQuantity,
        unitRate: String(t.unitRate),
        tierOrder: t.tierOrder,
      })),
    };
    const result = priceUsage(config, quantity);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Calculation error";
    const code = msg.includes("COVERAGE") ? "PRICING_COVERAGE_MISSING" : "PRICING_CONFIGURATION_INVALID";
    res.status(400).json({ code, message: msg });
  }
});

// GET /api/v1/pricing/tenant-view (for Tenant Admin)
router.get("/tenant-view", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenantId!;

  const configs = await prisma.tenantProcedurePricing.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: { tiers: { orderBy: { tierOrder: "asc" } }, category: true },
  });
  res.json({ items: configs });
});

function validateTiers(tiers: z.infer<typeof tierSchema>[]): string | null {
  if (tiers.length === 0) return "At least one tier is required";
  if (tiers[0].minimumQuantity !== 1) return "First tier must start at 1";

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (Number(t.unitRate) < 0) return `Tier ${t.tierOrder}: rate cannot be negative`;
    if (t.maximumQuantity !== null && t.maximumQuantity < t.minimumQuantity) {
      return `Tier ${t.tierOrder}: max must be >= min`;
    }
    if (i > 0) {
      const prev = tiers[i - 1];
      if (prev.maximumQuantity === null) return `Only the last tier may have an open-ended maximum`;
      if (t.minimumQuantity !== prev.maximumQuantity + 1) {
        return `Tier ${t.tierOrder}: must start at ${prev.maximumQuantity + 1} (no gaps or overlaps)`;
      }
    }
    if (t.maximumQuantity === null && i < tiers.length - 1) {
      return "Only the last tier may have an open-ended maximum";
    }
  }
  return null;
}

export default router;
