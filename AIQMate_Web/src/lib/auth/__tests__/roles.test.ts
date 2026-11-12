import { describe, expect, it } from "vitest";
import { TENANT_ROLES, canUsePortal, effectiveRoles, homePathFor, isPlatformRole, primaryRole, toRole } from "../roles";

describe("toRole (FR-WEB-010)", () => {
  it.each([
    ["ORG_ADMIN", "ORG_ADMIN"],
    ["OrgAdmin", "ORG_ADMIN"],
    ["SuperAdmin", "SUPER_ADMIN"],
    ["supervisor", "SUPERVISOR"],
    ["Expert", "EXPERT"],
  ])("reads %s as %s", (input, expected) => {
    expect(toRole(input)).toBe(expected);
  });

  it("rejects anything that is not a role", () => {
    expect(toRole("Leader")).toBeNull();
    expect(toRole(42)).toBeNull();
  });
});

describe("primaryRole", () => {
  it("picks the highest role a user holds", () => {
    expect(primaryRole(["OPERATOR", "SUPERVISOR"])).toBe("SUPERVISOR");
    expect(primaryRole(["MANAGER", "SUPER_ADMIN", "ORG_ADMIN"])).toBe("SUPER_ADMIN");
  });
  it("is null for no roles", () => expect(primaryRole([])).toBeNull());
});

describe("canUsePortal (FR-WEB-011)", () => {
  it("lets every role but Operator in", () => {
    expect(canUsePortal(["SUPERVISOR"])).toBe(true);
    expect(canUsePortal(["EXPERT"])).toBe(true);
    expect(canUsePortal(["ORG_ADMIN"])).toBe(true);
  });
  it("keeps an Operator-only user out", () => {
    expect(canUsePortal(["OPERATOR"])).toBe(false);
    expect(canUsePortal([])).toBe(false);
  });
  it("lets an Operator who also supervises in", () => {
    expect(canUsePortal(["OPERATOR", "SUPERVISOR"])).toBe(true);
  });
});

// ADR-012 §7 / FR-WEB-013: the Super Admin is the product owner's platform role.
describe("platform role helpers", () => {
  it("treats a user whose highest role is SUPER_ADMIN as platform-only", () => {
    expect(isPlatformRole(["SUPER_ADMIN"])).toBe(true);
    expect(isPlatformRole(["SUPER_ADMIN", "ORG_ADMIN"])).toBe(true);
    expect(isPlatformRole(["ORG_ADMIN"])).toBe(false);
  });

  it("effectiveRoles never mixes the platform role with tenant roles", () => {
    expect(effectiveRoles(["SUPER_ADMIN", "ORG_ADMIN"])).toEqual(["SUPER_ADMIN"]);
    expect(effectiveRoles(["ORG_ADMIN", "EXPERT"])).toEqual(["ORG_ADMIN", "EXPERT"]);
  });

  it("homePathFor sends the Super Admin to /platform and everyone else to /dashboard", () => {
    expect(homePathFor(["SUPER_ADMIN"])).toBe("/platform");
    expect(homePathFor(["SUPERVISOR"])).toBe("/dashboard");
  });

  it("TENANT_ROLES does not include the platform role", () => {
    expect(TENANT_ROLES).not.toContain("SUPER_ADMIN");
  });
});
