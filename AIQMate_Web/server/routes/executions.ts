import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireTenant } from "../middleware/auth";
import { logAudit } from "../services/audit";

const prisma = new PrismaClient();
const router = Router();

const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"] as const;

const createSchema = z.object({
  categoryId: z.string().uuid(),
  procedureRef: z.string().optional(),
  idempotencyKey: z.string().min(1).max(255),
});

const statusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

// POST /api/v1/executions
router.post("/", requireTenant, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") });
    return;
  }

  const { categoryId, procedureRef, idempotencyKey } = parsed.data;
  const tenantId = req.auth!.tenantId!;
  const userId = req.auth!.userId;

  const category = await prisma.procedureCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    res.status(400).json({ code: "INVALID_CATEGORY", message: "Procedure category not found" });
    return;
  }

  const existing = await prisma.procedureExecution.findUnique({ where: { idempotencyKey } });
  if (existing) {
    res.status(409).json({ code: "DUPLICATE_USAGE", message: "An execution with this idempotency key already exists", execution: existing });
    return;
  }

  const execution = await prisma.procedureExecution.create({
    data: {
      tenantId,
      userId,
      categoryId,
      procedureRef: procedureRef ?? null,
      idempotencyKey,
      status: "PENDING",
      isBillable: false,
      quantity: 1,
    },
  });

  await logAudit({
    tenantId,
    userId,
    action: "EXECUTION_CREATED",
    entityType: "ProcedureExecution",
    entityId: execution.id,
    after: { categoryId, procedureRef, idempotencyKey },
  });

  res.status(201).json(execution);
});

// PATCH /api/v1/executions/:id/status
router.patch("/:id/status", requireTenant, async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: parsed.error.issues.map((i) => i.message).join(". ") });
    return;
  }

  const { status } = parsed.data;
  const tenantId = req.auth!.tenantId!;

  const existing = await prisma.procedureExecution.findFirst({
    where: { id: req.params.id, tenantId },
  });
  if (!existing) {
    res.status(404).json({ code: "NOT_FOUND", message: "Execution not found" });
    return;
  }

  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const updateData: Record<string, unknown> = { status };

  if (status === "COMPLETED") {
    updateData.completedAt = now;
    updateData.isBillable = true;
    updateData.billingPeriod = billingPeriod;
  } else if (status === "FAILED") {
    updateData.failedAt = now;
    updateData.isBillable = false;
  } else if (status === "CANCELLED") {
    updateData.isBillable = false;
  }

  const execution = await prisma.procedureExecution.update({
    where: { id: req.params.id },
    data: updateData,
  });

  await logAudit({
    tenantId,
    userId: req.auth!.userId,
    action: "EXECUTION_STATUS_CHANGED",
    entityType: "ProcedureExecution",
    entityId: execution.id,
    before: { status: existing.status },
    after: { status },
  });

  res.json(execution);
});

// GET /api/v1/executions
router.get("/", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenantId!;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };
  if (req.query.categoryId) where.categoryId = req.query.categoryId;
  if (req.query.status) where.status = req.query.status;
  if (req.query.billingPeriod) where.billingPeriod = req.query.billingPeriod;

  const [items, total] = await Promise.all([
    prisma.procedureExecution.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { category: true } }),
    prisma.procedureExecution.count({ where }),
  ]);

  res.json({ items, total, page, limit });
});

// GET /api/v1/executions/usage-summary
router.get("/usage-summary", requireTenant, async (req, res) => {
  const tenantId = req.auth!.tenantId!;
  const billingPeriod = req.query.billingPeriod as string | undefined;

  const where: Record<string, unknown> = { tenantId };
  if (billingPeriod) where.billingPeriod = billingPeriod;

  const [total, completed, failed, cancelled, billable] = await Promise.all([
    prisma.procedureExecution.count({ where }),
    prisma.procedureExecution.count({ where: { ...where, status: "COMPLETED" } }),
    prisma.procedureExecution.count({ where: { ...where, status: "FAILED" } }),
    prisma.procedureExecution.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.procedureExecution.count({ where: { ...where, isBillable: true } }),
  ]);

  res.json({
    total,
    completed,
    failed,
    cancelled,
    billable,
    nonBillable: total - billable,
  });
});

export default router;
