import { afterEach, describe, expect, it, vi } from "vitest";
import { setAuthMode, writeDevRole } from "@/lib/api/client";
import { NoDevIdentity, devSession, fetchSession, rolesOf, toPortalUser } from "../session";

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthMode("entra");
  window.sessionStorage.clear();
});

describe("rolesOf (role comes from GET /users/me, never a token)", () => {
  it("collects distinct known roles in any casing", () => {
    expect(rolesOf({ user: { id: "u", orgId: "o" }, roles: [{ role: "SUPERVISOR" }, { role: "Supervisor" }, { role: "MANAGER" }] })).toEqual([
      "SUPERVISOR",
      "MANAGER",
    ]);
  });
  it("ignores unknown roles", () => {
    expect(rolesOf({ user: { id: "u", orgId: "o" }, roles: [{ role: "LEADER" }] })).toEqual([]);
  });
});

describe("toPortalUser", () => {
  it("joins first and last name, else uses the email", () => {
    expect(toPortalUser({ id: "u", orgId: "o", firstName: "Pat", lastName: "Super" }).displayName).toBe("Pat Super");
    expect(toPortalUser({ id: "u", orgId: "o", email: "pat@x.com" }).displayName).toBe("pat@x.com");
  });
});

describe("fetchSession", () => {
  it("entra: reads /users/me", async () => {
    const fn = vi.fn(async () => new Response(JSON.stringify({ user: { id: "u1", orgId: "o1", email: "a@b.c" }, roles: [{ role: "ORG_ADMIN" }] })));
    vi.stubGlobal("fetch", fn);
    await expect(fetchSession()).resolves.toMatchObject({ user: { id: "u1" }, roles: ["ORG_ADMIN"] });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("dev: builds the session from the picked role without calling the API", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn);
    setAuthMode("dev");
    writeDevRole("EXPERT");
    await expect(fetchSession()).resolves.toEqual(devSession("EXPERT"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("dev: no picked role means NoDevIdentity", async () => {
    setAuthMode("dev");
    await expect(fetchSession()).rejects.toBeInstanceOf(NoDevIdentity);
  });
});
