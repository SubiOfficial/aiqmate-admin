import { describe, expect, it } from "vitest";
import { NAV_ITEMS, navFor } from "../nav";

const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe("navFor (FR-WEB-030..031)", () => {
  it("shows only built modules when unbuilt entries are off (Production)", () => {
    expect(keys(navFor(["ORG_ADMIN"], false))).toEqual(["dashboard", "monitoring", "trail", "contacts", "configuration"]);
    expect(keys(navFor(["SUPER_ADMIN"], false))).toEqual(["platform", "assets", "tenants", "payment", "subscriptions"]);
  });

  it("gives an Org Admin every customer module on Dev, and no platform module", () => {
    const k = keys(navFor(["ORG_ADMIN"], true));
    expect(k).toEqual([
      "dashboard",
      "monitoring",
      "trail",
      "contacts",
      "configuration",
      "approvals",
      "hierarchy",
      "users",
      "reports",
      "expert",
      "notifications",
    ]);
    expect(k).not.toContain("platform");
    expect(k).not.toContain("tenants");
    expect(k).not.toContain("subscriptions");
  });
});

// ADR-012 §7 / FR-WEB-013 (2026-11-03): the Super Admin is the product owner's platform role.
describe("the Super Admin sees the platform only", () => {
  const PLATFORM_KEYS = ["platform", "assets", "tenants", "payment", "subscriptions"];

  it("sees only platform modules on Dev", () => {
    expect(keys(navFor(["SUPER_ADMIN"], true))).toEqual(PLATFORM_KEYS);
  });

  it("no customer-data module lists SUPER_ADMIN", () => {
    const leaking = NAV_ITEMS.filter((i) => !PLATFORM_KEYS.includes(i.key) && i.roles.includes("SUPER_ADMIN"));
    expect(leaking.map((i) => i.key)).toEqual([]);
  });

  it("no platform module lists a tenant role", () => {
    const mixed = NAV_ITEMS.filter((i) => PLATFORM_KEYS.includes(i.key) && i.roles.some((r) => r !== "SUPER_ADMIN"));
    expect(mixed.map((i) => i.key)).toEqual([]);
  });

  it("a Super Admin who also holds a tenant role is still platform-only (the API decides by the highest role)", () => {
    expect(keys(navFor(["SUPER_ADMIN", "ORG_ADMIN"], true))).toEqual(PLATFORM_KEYS);
  });
});

describe("navFor, other roles", () => {

  it("gives a Supervisor the dashboard and approvals, not administration", () => {
    const k = keys(navFor(["SUPERVISOR"], true));
    expect(k).toEqual(expect.arrayContaining(["dashboard", "approvals"]));
    expect(k).not.toContain("users");
    expect(k).not.toContain("hierarchy");
    expect(k).not.toContain("monitoring");
    expect(k).not.toContain("trail");
    expect(k).not.toContain("contacts");
    expect(k).not.toContain("configuration");
  });

  it("gives an Operator nothing", () => {
    expect(navFor(["OPERATOR"], true)).toEqual([]);
  });

  it("has unique keys and hrefs", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.key)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
  });

  it("routes every unbuilt module to its Not built yet page", () => {
    for (const i of NAV_ITEMS.filter((n) => !n.built)) expect(i.href).toBe(`/not-built/${i.key}`);
  });
});
