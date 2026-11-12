import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuditEntry {
  tenantId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before as object ?? undefined,
        after: entry.after as object ?? undefined,
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}
