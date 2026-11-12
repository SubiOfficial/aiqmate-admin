import type { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthContext {
  userId: string;
  tenantId: string | null;
  orgId: string | null;
  isSuperAdmin: boolean;
  role: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userIdHeader = req.headers["x-user-id"] as string | undefined;
  const orgIdHeader = req.headers["x-org-id"] as string | undefined;
  const roleHeader = req.headers["x-user-role"] as string | undefined;

  if (!userIdHeader) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  let user = await prisma.user.findFirst({ where: { id: userIdHeader } });

  if (!user) {
    user = await prisma.user.findFirst({ where: { email: userIdHeader } });
  }

  if (!user) {
    const isSuperAdmin = roleHeader === "SuperAdmin" || roleHeader === "SUPER_ADMIN";
    user = await prisma.user.upsert({
      where: { email: userIdHeader.includes("@") ? userIdHeader : `${userIdHeader}@dev.local` },
      update: { lastLoginAt: new Date() },
      create: {
        email: userIdHeader.includes("@") ? userIdHeader : `${userIdHeader}@dev.local`,
        firstName: "Dev",
        lastName: roleHeader ?? "User",
        isSuperAdmin,
        isActive: true,
      },
    });
  }

  let tenantId: string | null = null;
  let orgId: string | null = null;
  let role: string | null = roleHeader ?? null;
  let permissions: string[] = [];

  if (orgIdHeader) {
    const tenant = await prisma.tenant.findUnique({ where: { orgId: orgIdHeader }, select: { id: true, orgId: true } });
    if (tenant) {
      tenantId = tenant.id;
      orgId = tenant.orgId;
    }

    if (tenantId && !user.isSuperAdmin) {
      const membership = await prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (membership && membership.isActive) {
        role = membership.role.key;
        permissions = membership.role.permissions.map((rp) => rp.permission.key);
      }
    }
  }

  req.auth = {
    userId: user.id,
    tenantId,
    orgId,
    isSuperAdmin: user.isSuperAdmin,
    role,
    permissions,
  };

  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.isSuperAdmin) {
    res.status(403).json({ code: "FORBIDDEN", message: "Super Admin access required" });
    return;
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.tenantId) {
    res.status(400).json({ code: "TENANT_NOT_FOUND", message: "Tenant context required" });
    return;
  }
  next();
}

export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.auth?.isSuperAdmin) { next(); return; }
    if (!req.auth?.role || !allowed.includes(req.auth.role)) {
      res.status(403).json({ code: "FORBIDDEN", message: "Insufficient role" });
      return;
    }
    next();
  };
}

export function requirePermission(...needed: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.auth?.isSuperAdmin) { next(); return; }
    const has = new Set(req.auth?.permissions ?? []);
    if (!needed.every((p) => has.has(p))) {
      res.status(403).json({ code: "FORBIDDEN", message: "Missing permission" });
      return;
    }
    next();
  };
}
