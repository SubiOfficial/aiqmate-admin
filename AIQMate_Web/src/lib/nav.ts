// SPEC-036 FR-WEB-030..032. The portal's modules, who sees each, and which are built.
// Adding a module is a row here. An unbuilt row is shown only where SHOW_UNBUILT is true.

import { enabledModules, moduleName, type EffectiveMetadata } from "@/lib/api/metadata";
import type { Role } from "@/lib/auth/roles";
import { effectiveRoles, hasAnyRole } from "@/lib/auth/roles";
import { MODULE_REGISTRY, moduleHref, type ModuleIcon } from "@/lib/modules";

export type NavIcon =
  | "dashboard"
  | "platform"
  | "monitoring"
  | "trail"
  | "contacts"
  | "approvals"
  | "hierarchy"
  | "users"
  | "org"
  | "subscription"
  | "notifications"
  | "expert"
  | "reports"
  | "settings"
  | "assets"
  | "payment"
  | ModuleIcon;

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  roles: readonly Role[];
  built: boolean;
  /** One line for the Not built yet page: what the module will do and where it is specified. */
  summary: string;
}

// ADR-012 §7 / FR-WEB-013 (2026-11-03): SUPER_ADMIN is the platform role and appears ONLY on
// platform rows. Every row that shows a customer's data lists tenant roles only; the Org Admin is
// the admin inside an organisation. nav.test.ts fails if SUPER_ADMIN is added to a tenant row.
const ORG_ADMIN_ONLY: readonly Role[] = ["ORG_ADMIN"];
const APPROVERS: readonly Role[] = ["ORG_ADMIN", "MANAGER", "SUPERVISOR"];
const ALL_TENANT: readonly Role[] = ["ORG_ADMIN", "MANAGER", "SUPERVISOR", "EXPERT"];
const PLATFORM: readonly Role[] = ["SUPER_ADMIN"];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    roles: ALL_TENANT,
    built: true,
    summary: "Counts across the organisation and your team's recent work.",
  },
  // SPEC-038 US-004..US-006: the Org Admin's own monitoring and administration.
  {
    key: "monitoring",
    label: "Monitoring",
    href: "/monitoring",
    icon: "monitoring",
    roles: ORG_ADMIN_ONLY,
    built: true,
    summary: "Procedures, routines and tasks across your organisation, with a 6-month trend.",
  },
  {
    key: "trail",
    label: "Activity trail",
    href: "/activity-trail",
    icon: "trail",
    roles: ORG_ADMIN_ONLY,
    built: true,
    summary: "Who did what and when: tasks, people, content and audits.",
  },
  {
    key: "contacts",
    label: "Company contacts",
    href: "/company-contacts",
    icon: "contacts",
    roles: ORG_ADMIN_ONLY,
    built: true,
    summary: "The 2 to 3 people San-Tech contacts about your account and subscription.",
  },
  // SPEC-039 US-003 / US-004: the tenant's own names, modules and custom fields.
  {
    key: "configuration",
    label: "Configuration",
    href: "/configuration",
    icon: "settings",
    roles: ORG_ADMIN_ONLY,
    built: true,
    summary: "Your organisation's names for each module, which modules are on, and custom fields.",
  },
  {
    key: "platform",
    label: "Dashboard",
    href: "/platform",
    icon: "dashboard",
    roles: PLATFORM,
    built: true,
    summary: "Platform insights across all tenants: subscriptions, seats, adoption and trends. No customer data.",
  },
  {
    key: "assets",
    label: "Assets",
    href: "/assets",
    icon: "assets",
    roles: PLATFORM,
    built: true,
    summary: "Configurable operational hierarchy: divisions, plants, equipment and components.",
  },
  // SPEC-038 US-001..US-003: tenant accounts, contacts and aggregate usage. No people data or content.
  {
    key: "tenants",
    label: "Tenants",
    href: "/tenants",
    icon: "org",
    roles: PLATFORM,
    built: true,
    summary: "Every customer organisation: subscription, seats, contacts and aggregate usage.",
  },
  {
    key: "payment",
    label: "Payment",
    href: "/payments",
    icon: "payment",
    roles: PLATFORM,
    built: true,
    summary: "Payment history, invoices and billing across all tenants.",
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/not-built/approvals",
    icon: "approvals",
    roles: APPROVERS,
    built: false,
    summary: "Review and decide submissions waiting for approval. GET /approvals (SPEC-028).",
  },
  {
    key: "hierarchy",
    label: "Hierarchy & Assets",
    href: "/not-built/hierarchy",
    icon: "hierarchy",
    roles: ORG_ADMIN_ONLY,
    built: false,
    summary: "Configure levels, import the hierarchy and assets from CSV, edit and remove assets (SPEC-006 US-10, US-12).",
  },
  {
    key: "users",
    label: "Users",
    href: "/not-built/users",
    icon: "users",
    roles: ORG_ADMIN_ONLY,
    built: false,
    summary: "Invite, suspend, reactivate and offboard users, and assign roles and scopes (SPEC-023).",
  },
  {
    key: "reports",
    label: "Reports",
    href: "/not-built/reports",
    icon: "reports",
    roles: APPROVERS,
    built: false,
    summary: "Audit, BDA and procedure run reports for your sites and lines.",
  },
  {
    key: "expert",
    label: "Expert Work",
    href: "/not-built/expert",
    icon: "expert",
    roles: ["ORG_ADMIN", "EXPERT"],
    built: false,
    summary: "Edit procedures, copy procedures across plants and edit audit logs remotely.",
  },
  {
    key: "notifications",
    label: "Notifications",
    href: "/not-built/notifications",
    icon: "notifications",
    roles: ORG_ADMIN_ONLY,
    built: false,
    summary: "Configure notification and reminder events for the organisation (SPEC-022).",
  },
  {
    key: "subscriptions",
    label: "Subscriptions",
    href: "/subscription",
    icon: "subscription",
    roles: PLATFORM,
    built: true,
    summary: "Subscription models, payment terms and seat limits.",
  },
];

/** The entries a user with `roles` sees. Unbuilt entries are left out unless `showUnbuilt`. */
export function navFor(roles: readonly Role[], showUnbuilt: boolean): NavItem[] {
  const mine = effectiveRoles(roles);
  return NAV_ITEMS.filter((i) => hasAnyRole(mine, i.roles) && (i.built || showUnbuilt));
}

export function unbuiltItem(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key && !i.built);
}

// ---- SPEC-039 US-001: the Work section, built from the tenant's metadata ----

/** FR-MD-020: who may open a module page. Tenant roles only; never the Super Admin (ADR-012 §7). */
export const WORK_ROLES: readonly Role[] = ALL_TENANT;

export const WORK_KEY_PREFIX = "work-";

/**
 * The enabled modules in the tenant's order with its plural names. A module without a portal page
 * appears only where `showUnbuilt` is true (FR-MD-021, CLAUDE.md 5i). A Super Admin gets none.
 */
export function workNavFor(roles: readonly Role[], showUnbuilt: boolean, meta: EffectiveMetadata | undefined): NavItem[] {
  if (!hasAnyRole(effectiveRoles(roles), WORK_ROLES)) return [];
  return enabledModules(meta)
    .map((key) => MODULE_REGISTRY[key])
    .filter((m) => m.source !== null || showUnbuilt)
    .map((m) => ({
      key: `${WORK_KEY_PREFIX}${m.slug}`,
      label: moduleName(meta, m.key, "plural"),
      href: moduleHref(m.key),
      icon: m.icon,
      roles: WORK_ROLES,
      built: m.source !== null,
      summary: `${m.plural} of your organisation.`,
    }));
}

export interface NavSection {
  id: "top" | "work" | "admin";
  /** Shown as a section header; the first section has none. */
  title: string | null;
  items: NavItem[];
}

/** The whole menu: Dashboard, then Work, then everything else the role may open. Empty sections are dropped. */
export function navSections(roles: readonly Role[], showUnbuilt: boolean, meta: EffectiveMetadata | undefined): NavSection[] {
  const all = navFor(roles, showUnbuilt);
  const sections: NavSection[] = [
    { id: "top", title: null, items: all.filter((i) => i.key === "dashboard") },
    { id: "work", title: "Work", items: workNavFor(roles, showUnbuilt, meta) },
    { id: "admin", title: null, items: all.filter((i) => i.key !== "dashboard") },
  ];
  return sections.filter((s) => s.items.length > 0);
}
