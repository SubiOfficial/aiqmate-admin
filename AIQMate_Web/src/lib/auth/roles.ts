// SPEC-036 FR-WEB-010..012. Roles as the API stores them (Prisma `Role`), and who may use the portal.

export const ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SUPERVISOR", "OPERATOR", "EXPERT"] as const;
export type Role = (typeof ROLES)[number];

/** Highest first. Used to pick the one role a multi-role user is shown as. */
const RANK: Record<Role, number> = {
  SUPER_ADMIN: 6,
  ORG_ADMIN: 5,
  MANAGER: 4,
  SUPERVISOR: 3,
  EXPERT: 2,
  OPERATOR: 1,
};

/** FR-WEB-011. Operators work on the phone; the portal is for everyone else. */
export const PORTAL_ROLES: readonly Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER", "SUPERVISOR", "EXPERT"];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Org Admin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  OPERATOR: "Operator",
  EXPERT: "Expert",
};

/** The dev-auth guard's PascalCase spelling (api-service dev-auth.guard.ts VALID_ROLES). */
export const DEV_HEADER_ROLE: Record<Role, string> = {
  SUPER_ADMIN: "SuperAdmin",
  ORG_ADMIN: "OrgAdmin",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  OPERATOR: "Operator",
  EXPERT: "Expert",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Normalises any casing the API may send ('Supervisor', 'supervisor', 'ORG_ADMIN', 'OrgAdmin'). */
export function toRole(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const snake = value
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
  return isRole(snake) ? snake : null;
}

export function primaryRole(roles: readonly Role[]): Role | null {
  if (roles.length === 0) return null;
  return [...roles].sort((a, b) => RANK[b] - RANK[a])[0];
}

export function canUsePortal(roles: readonly Role[]): boolean {
  return roles.some((r) => PORTAL_ROLES.includes(r));
}

export function hasAnyRole(roles: readonly Role[], allowed: readonly Role[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

// ADR-012 §7 / SPEC-036 FR-WEB-013. SUPER_ADMIN is the product owner's PLATFORM role: it manages
// organisations and subscriptions and never sees a customer's data. Inside an organisation the
// Org Admin is the admin. The API decides by the caller's highest role, so the portal does too:
// whoever's highest role is SUPER_ADMIN is platform-only, whatever else they hold.

/** Roles that work inside a customer organisation and may see its data. */
export const TENANT_ROLES: readonly Role[] = ["ORG_ADMIN", "MANAGER", "SUPERVISOR", "EXPERT"];

export function isPlatformRole(roles: readonly Role[]): boolean {
  return primaryRole(roles) === "SUPER_ADMIN";
}

/** The roles that decide what a user may open: SUPER_ADMIN alone, or the tenant roles alone. */
export function effectiveRoles(roles: readonly Role[]): Role[] {
  return isPlatformRole(roles) ? ["SUPER_ADMIN"] : roles.filter((r) => r !== "SUPER_ADMIN");
}

/** Where a signed-in user lands. */
export function homePathFor(roles: readonly Role[]): "/platform" | "/dashboard" {
  return isPlatformRole(roles) ? "/platform" : "/dashboard";
}
