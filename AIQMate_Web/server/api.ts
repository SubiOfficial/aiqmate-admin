import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import express from "express";
import { authMiddleware } from "./middleware/auth";
import pricingRoutes from "./routes/pricing";
import executionRoutes from "./routes/executions";
import billingRoutes from "./routes/billing";
import dashboardRoutes from "./routes/dashboard";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Public endpoints (no auth required)
// ---------------------------------------------------------------------------

app.get("/api/v1/web-auth/config", (_req, res) => {
  res.json({
    authMode: "dev",
    environment: "local",
    showUnbuilt: true,
    branding: { customerName: null, logoUrl: null },
  });
});

app.post("/api/v1/web-auth/sign-out", (_req, res) => res.status(204).send());

// ---------------------------------------------------------------------------
// Auth middleware for all subsequent routes
// ---------------------------------------------------------------------------

app.use(authMiddleware);

// ---------------------------------------------------------------------------
// Users/me
// ---------------------------------------------------------------------------

app.get("/api/v1/users/me", (req, res) => {
  const id = req.auth?.userId ?? "unknown";
  const orgId = req.auth?.orgId ?? "demo-org";
  const isSuperAdmin = req.auth?.isSuperAdmin ?? false;
  res.json({
    user: { id, orgId, email: null, firstName: "Dev", lastName: isSuperAdmin ? "Super Admin" : "User" },
    roles: [{ role: isSuperAdmin ? "SuperAdmin" : (req.auth?.role ?? "OrgAdmin") }],
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

app.get("/api/v1/dashboard/home", async (req, res) => {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    res.json({ kpis: { tasks: { count: 0, inProgress: 0 }, procedures: 0, routines: 0, inspections: 0, bda: 0, audits: 0, areaMaps: 0 } });
    return;
  }
  const execCount = await prisma.procedureExecution.count({ where: { tenantId } });
  const billable = await prisma.procedureExecution.count({ where: { tenantId, isBillable: true } });
  res.json({ kpis: { tasks: { count: execCount, inProgress: 0 }, procedures: billable, routines: 0, inspections: 0, bda: 0, audits: 0, areaMaps: 0 } });
});

// ---------------------------------------------------------------------------
// Platform insights (Super Admin)
// ---------------------------------------------------------------------------

app.get("/api/v1/platform/insights", async (req, res) => {
  const tenants = await prisma.tenant.findMany();
  const subs = await prisma.subscription.findMany();
  const totalExec = await prisma.procedureExecution.count();
  const billableExec = await prisma.procedureExecution.count({ where: { isBillable: true } });
  const invoices = await prisma.invoice.findMany();
  const payments = await prisma.payment.findMany();

  const total = tenants.length;
  const billedRevenue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const collectedRevenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0);
  const outstandingRevenue = invoices.filter((i) => i.status === "OPEN" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.outstandingBalance), 0);

  res.json({
    generatedAt: new Date().toISOString(),
    tenants: {
      total,
      trial: subs.filter((s) => s.status === "TRIAL").length,
      active: subs.filter((s) => s.status === "ACTIVE").length,
      expired: subs.filter((s) => s.status === "EXPIRED").length,
    },
    seats: { limit: tenants.reduce((s, t) => s + t.seatLimit, 0), used: tenants.reduce((s, t) => s + t.seatsUsed, 0) },
    users: { active: tenants.reduce((s, t) => s + t.seatsUsed, 0), activeLast30d: tenants.reduce((s, t) => s + t.activeUsers30d, 0) },
    executions: { total: totalExec, billable: billableExec },
    revenue: { billed: billedRevenue, collected: collectedRevenue, outstanding: outstandingRevenue, refunded: 0 },
    subscriptions: { active: subs.filter((s) => s.status === "ACTIVE").length, expired: subs.filter((s) => s.status === "EXPIRED").length },
    payments: { pending: payments.filter((p) => p.status === "PENDING").length, failed: payments.filter((p) => p.status === "FAILED").length },
    adoption: [],
    ai: { month: new Date().toISOString().slice(0, 7), jobs: 0, estCostUsd: 0 },
    monthly: [],
    attention: tenants.filter((t) => t.health === "ATTENTION").map((t) => ({
      orgId: t.orgId, name: t.name, health: t.health, reasons: ["NO_RECENT_ACTIVITY"],
      industry: t.industry, country: t.country,
      subscription: { status: "ACTIVE", trialEndsAt: null },
      seats: { limit: t.seatLimit, used: t.seatsUsed },
      primaryContact: null, contactCount: 0,
      activeUsers30d: t.activeUsers30d, lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
    })),
  });
});

app.get("/api/v1/platform/tenants", async (_req, res) => {
  const tenants = await prisma.tenant.findMany({ include: { contacts: true, subscription: true } });
  res.json({
    items: tenants.map((t) => ({
      orgId: t.orgId, name: t.name, industry: t.industry, country: t.country,
      subscription: { status: t.subscription?.status ?? "TRIAL", trialEndsAt: t.subscription?.trialEndsAt?.toISOString() ?? null },
      seats: { limit: t.seatLimit, used: t.seatsUsed },
      primaryContact: t.contacts.find((c) => c.isPrimary) ? { id: t.contacts.find((c) => c.isPrimary)!.id, name: t.contacts.find((c) => c.isPrimary)!.name, email: t.contacts.find((c) => c.isPrimary)!.email } : null,
      contactCount: t.contacts.length,
      activeUsers30d: t.activeUsers30d,
      lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      health: t.health, reasons: t.health === "ATTENTION" ? ["NO_RECENT_ACTIVITY"] : [],
    })),
  });
});

app.get("/api/v1/platform/tenants/:orgId", async (req, res) => {
  const t = await prisma.tenant.findUnique({
    where: { orgId: req.params.orgId },
    include: { contacts: true, subscription: true },
  });
  if (!t) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }

  const execCount = await prisma.procedureExecution.count({ where: { tenantId: t.id } });
  const billable = await prisma.procedureExecution.count({ where: { tenantId: t.id, isBillable: true } });

  res.json({
    tenant: {
      orgId: t.orgId, name: t.name, industry: t.industry, country: t.country,
      subscription: { status: t.subscription?.status ?? "TRIAL", trialEndsAt: t.subscription?.trialEndsAt?.toISOString() ?? null },
      seats: { limit: t.seatLimit, used: t.seatsUsed },
      primaryContact: t.contacts.find((c) => c.isPrimary) ?? null,
      contactCount: t.contacts.length,
      activeUsers30d: t.activeUsers30d, lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      health: t.health, reasons: t.health === "ATTENTION" ? ["NO_RECENT_ACTIVITY"] : [],
    },
    profile: { industry: t.industry, country: t.country, website: t.website },
    contacts: t.contacts,
    usage: {
      generatedAt: new Date().toISOString(),
      executions: { total: execCount, billable },
      users: { active: t.seatsUsed, invited: 0, suspended: 0, deactivated: 0, activeLast30d: t.activeUsers30d, byRole: {} },
      content: { procedures: 0, routines: 0, inspections: 0, tasks: 0, audits: 0, bda: 0 },
      ai: { month: new Date().toISOString().slice(0, 7), jobs: 0, estCostUsd: 0, capUsd: null },
      adoption: {},
    },
  });
});

// ---------------------------------------------------------------------------
// Asset hierarchy (preserved from original, now behind auth)
// ---------------------------------------------------------------------------

function tenantIdFromAuth(req: express.Request): string | null {
  return req.auth?.tenantId ?? null;
}

app.get("/api/v1/asset-hierarchy/config", async (req, res) => {
  const tid = tenantIdFromAuth(req);
  if (!tid) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  const levels = await prisma.tenantAssetHierarchyLevel.findMany({ where: { tenantId: tid, isEnabled: true }, orderBy: { levelOrder: "asc" } });
  res.json(levels);
});

app.put("/api/v1/asset-hierarchy/config", async (req, res) => {
  const tid = tenantIdFromAuth(req);
  if (!tid) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  const { levels } = req.body;

  const existingAssets = await prisma.asset.count({ where: { tenantId: tid } });
  if (existingAssets > 0) {
    const existingLevels = await prisma.tenantAssetHierarchyLevel.findMany({ where: { tenantId: tid } });
    const existingIds = new Set(existingLevels.map((l) => l.id));
    const incomingKeys = new Set((levels as { levelKey: string }[]).map((l) => l.levelKey));
    const usedLevels = await prisma.asset.findMany({ where: { tenantId: tid }, select: { hierarchyLevelId: true }, distinct: ["hierarchyLevelId"] });
    const usedIds = new Set(usedLevels.map((a) => a.hierarchyLevelId));
    for (const id of usedIds) {
      const lvl = existingLevels.find((l) => l.id === id);
      if (lvl && !incomingKeys.has(lvl.levelKey)) {
        res.status(400).json({ code: "LEVEL_IN_USE", message: `Cannot remove level "${lvl.displayName}" because assets use it` });
        return;
      }
    }
  }

  await prisma.tenantAssetHierarchyLevel.deleteMany({ where: { tenantId: tid } });
  const created = await Promise.all(
    (levels as { levelKey: string; displayName: string; pluralName: string; levelOrder: number; isEnabled: boolean; isRootLevel: boolean; allowMultipleChildren: boolean; icon?: string | null }[]).map((l) =>
      prisma.tenantAssetHierarchyLevel.create({
        data: { tenantId: tid, levelKey: l.levelKey, displayName: l.displayName, pluralName: l.pluralName, levelOrder: l.levelOrder, isEnabled: l.isEnabled, isRootLevel: l.isRootLevel, allowMultipleChildren: l.allowMultipleChildren, icon: l.icon ?? null },
      }),
    ),
  );
  res.json(created);
});

app.get("/api/v1/assets/hierarchy", async (req, res) => {
  const tid = tenantIdFromAuth(req);
  if (!tid) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  const assets = await prisma.asset.findMany({ where: { tenantId: tid }, orderBy: { createdAt: "asc" } });
  interface TNode { id: string; tenantId: string; parentAssetId: string | null; hierarchyLevelId: string; assetCode: string; defaultName: string; displayName: string | null; status: string; criticality: string; location: string | null; assetClass: string | null; assetModel: string | null; modelTemplateId: string | null; isActive: boolean; metadata: unknown; createdBy: string | null; updatedBy: string | null; createdAt: string; updatedAt: string; children: TNode[]; procedureCount: number; arPinCount: number; insightCount: number; }
  const flat: TNode[] = assets.map((a) => ({ id: a.id, tenantId: a.tenantId, parentAssetId: a.parentAssetId, hierarchyLevelId: a.hierarchyLevelId, assetCode: a.assetCode, defaultName: a.defaultName, displayName: a.displayName, status: a.status, criticality: a.criticality, location: a.location, assetClass: a.assetClass, assetModel: a.assetModel, modelTemplateId: a.modelTemplateId, isActive: a.isActive, metadata: a.metadata, createdBy: a.createdBy, updatedBy: a.updatedBy, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 }));
  function buildTree(nodes: TNode[], parentId: string | null = null): TNode[] { return nodes.filter((a) => a.parentAssetId === parentId).map((a) => ({ ...a, children: buildTree(nodes, a.id) })); }
  res.json(buildTree(flat));
});

app.get("/api/v1/assets/:id", async (req, res) => {
  const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, include: { hierarchyLevel: true } });
  if (!asset) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && asset.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) {
    res.status(403).json({ code: "TENANT_ACCESS_DENIED", message: "Not your tenant" }); return;
  }
  res.json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.post("/api/v1/assets", async (req, res) => {
  const tid = tenantIdFromAuth(req);
  if (!tid) { res.status(404).json({ code: "TENANT_NOT_FOUND", message: "Tenant not found" }); return; }
  const { parentAssetId, hierarchyLevelId, defaultName, displayName, status, criticality, location } = req.body;
  const level = await prisma.tenantAssetHierarchyLevel.findFirst({ where: { id: hierarchyLevelId, tenantId: tid } });
  if (!level) { res.status(400).json({ code: "INVALID_LEVEL", message: "Hierarchy level not found for this tenant" }); return; }
  if (parentAssetId) {
    const parent = await prisma.asset.findFirst({ where: { id: parentAssetId, tenantId: tid } });
    if (!parent) { res.status(400).json({ code: "INVALID_PARENT", message: "Parent asset not found in this tenant" }); return; }
  }
  const count = await prisma.asset.count({ where: { tenantId: tid } });
  const assetCode = `${level.levelKey.toUpperCase()}-${String(count + 1).padStart(4, "0")}`;
  const asset = await prisma.asset.create({
    data: { tenantId: tid, parentAssetId: parentAssetId ?? null, hierarchyLevelId, assetCode, defaultName, displayName: displayName ?? null, status: status ?? "ACTIVE", criticality: criticality ?? "STANDARD", location: location ?? null, createdBy: req.auth?.userId, updatedBy: req.auth?.userId },
    include: { hierarchyLevel: true },
  });
  res.status(201).json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.put("/api/v1/assets/:id", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && existing.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) { res.status(403).json({ code: "TENANT_ACCESS_DENIED" }); return; }
  const { defaultName, displayName, status, criticality, location, assetClass, assetModel } = req.body;
  const asset = await prisma.asset.update({
    where: { id: req.params.id },
    data: { ...(defaultName !== undefined && { defaultName }), ...(displayName !== undefined && { displayName }), ...(status !== undefined && { status }), ...(criticality !== undefined && { criticality }), ...(location !== undefined && { location }), ...(assetClass !== undefined && { assetClass }), ...(assetModel !== undefined && { assetModel }), updatedBy: req.auth?.userId },
    include: { hierarchyLevel: true },
  });
  res.json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.patch("/api/v1/assets/:id/rename", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && existing.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) { res.status(403).json({ code: "TENANT_ACCESS_DENIED" }); return; }
  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: { displayName: req.body.displayName ?? null, updatedBy: req.auth?.userId }, include: { hierarchyLevel: true } });
  res.json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.patch("/api/v1/assets/:id/move", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && existing.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) { res.status(403).json({ code: "TENANT_ACCESS_DENIED" }); return; }
  const { newParentId } = req.body;
  if (newParentId) {
    let cur: string | null = newParentId;
    while (cur) { if (cur === req.params.id) { res.status(400).json({ code: "CIRCULAR_REFERENCE", message: "Cannot move under own descendant" }); return; } const p = await prisma.asset.findUnique({ where: { id: cur }, select: { parentAssetId: true } }); cur = p?.parentAssetId ?? null; }
  }
  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: { parentAssetId: newParentId ?? null, updatedBy: req.auth?.userId }, include: { hierarchyLevel: true } });
  res.json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.patch("/api/v1/assets/:id/status", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && existing.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) { res.status(403).json({ code: "TENANT_ACCESS_DENIED" }); return; }
  const asset = await prisma.asset.update({ where: { id: req.params.id }, data: { isActive: !!req.body.isActive, updatedBy: req.auth?.userId }, include: { hierarchyLevel: true } });
  res.json({ ...asset, createdAt: asset.createdAt.toISOString(), updatedAt: asset.updatedAt.toISOString(), children: [], procedureCount: 0, arPinCount: 0, insightCount: 0 });
});

app.delete("/api/v1/assets/:id", async (req, res) => {
  const existing = await prisma.asset.findUnique({ where: { id: req.params.id }, include: { children: { select: { id: true } } } });
  if (!existing) { res.status(404).json({ code: "NOT_FOUND", message: "Asset not found" }); return; }
  if (req.auth?.tenantId && existing.tenantId !== req.auth.tenantId && !req.auth.isSuperAdmin) { res.status(403).json({ code: "TENANT_ACCESS_DENIED" }); return; }
  if (existing.children.length > 0) { res.status(400).json({ code: "HAS_CHILDREN", message: "Remove or move children first" }); return; }
  await prisma.asset.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Mount route modules
// ---------------------------------------------------------------------------

app.use("/api/v1/pricing", pricingRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/executions", executionRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1", billingRoutes);

// ---------------------------------------------------------------------------
// Procedure categories (for pricing UI)
// ---------------------------------------------------------------------------

app.get("/api/v1/procedure-categories", async (_req, res) => {
  const cats = await prisma.procedureCategory.findMany({ where: { isActive: true }, orderBy: { displayName: "asc" } });
  res.json({ items: cats });
});

// ---------------------------------------------------------------------------
// Subscription endpoints
// ---------------------------------------------------------------------------

app.get("/api/v1/subscriptions", async (req, res) => {
  const tenantId = req.query.tenantId as string | undefined ?? req.auth?.tenantId;
  if (!tenantId) { res.status(400).json({ code: "MISSING_TENANT", message: "tenantId required" }); return; }
  const sub = await prisma.subscription.findUnique({ where: { tenantId } });
  res.json(sub);
});

// ---------------------------------------------------------------------------
// Serve built frontend in production
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ code: "INTERNAL_ERROR", message: "An unexpected error occurred" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`AIQMate API server running on http://localhost:${PORT}`);
  console.log(`  Auth: dev-mode headers`);
  console.log(`  Database: PostgreSQL (aiqmate)`);
  console.log(`  Routes: web-auth, users, dashboard, platform, assets, pricing, executions, billing, subscriptions`);
});
