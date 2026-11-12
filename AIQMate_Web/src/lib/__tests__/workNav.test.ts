// SPEC-039 US-001: the Work section follows the tenant's metadata.
import { describe, expect, it } from "vitest";
import { metadataFixture } from "@/test/metadataFixture";
import { navSections, workNavFor } from "../nav";

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("workNavFor (SPEC-039 US-001)", () => {
  it("lists the built modules in pack order on Production (AC-1)", () => {
    expect(labels(workNavFor(["ORG_ADMIN"], false, metadataFixture()))).toEqual([
      "Procedures",
      "Routines",
      "Inspections",
      "Tasks",
      "Guides",
      "Breakdown analyses",
    ]);
  });

  it("adds the modules without a page, marked unbuilt, only where showUnbuilt (FR-MD-021)", () => {
    const items = workNavFor(["ORG_ADMIN"], true, metadataFixture());
    expect(items).toHaveLength(10);
    expect(items.filter((i) => !i.built).map((i) => i.label)).toEqual(["Audits", "Flix", "Area maps", "Captures"]);
  });

  it("uses the tenant's names and order (AC-2)", () => {
    const m = metadataFixture({ PROCEDURE: { singular: "SOP", plural: "SOPs", order: 5 }, TASK: { order: 4 }, GUIDE: { order: 1 } });
    const items = workNavFor(["MANAGER"], false, m);
    expect(labels(items)).toEqual(["Guides", "Routines", "Inspections", "Tasks", "SOPs", "Breakdown analyses"]);
    expect(items.find((i) => i.label === "SOPs")?.href).toBe("/work/procedures");
  });

  it("leaves out a module that is switched off (AC-3)", () => {
    expect(labels(workNavFor(["SUPERVISOR"], false, metadataFixture({ ROUTINE: { enabled: false } })))).not.toContain("Routines");
  });

  it("gives every tenant role the section and the Super Admin none (AC-4)", () => {
    for (const r of ["ORG_ADMIN", "MANAGER", "SUPERVISOR", "EXPERT"] as const) {
      expect(workNavFor([r], false, metadataFixture())).toHaveLength(6);
    }
    expect(workNavFor(["SUPER_ADMIN"], true, metadataFixture())).toEqual([]);
    expect(workNavFor(["SUPER_ADMIN", "ORG_ADMIN"], true, metadataFixture())).toEqual([]);
    expect(workNavFor(["OPERATOR"], true, metadataFixture())).toEqual([]);
  });

  it("falls back to the standard names and order while metadata loads", () => {
    expect(labels(workNavFor(["ORG_ADMIN"], false, undefined))[0]).toBe("Procedures");
  });
});

describe("navSections", () => {
  it("puts Dashboard first, then Work, then the rest", () => {
    const s = navSections(["ORG_ADMIN"], false, metadataFixture());
    expect(s.map((x) => x.id)).toEqual(["top", "work", "admin"]);
    expect(s[0].items.map((i) => i.key)).toEqual(["dashboard"]);
    expect(s[1].title).toBe("Work");
    expect(s[2].items.map((i) => i.key)).toContain("configuration");
  });

  it("gives the Super Admin only the platform section", () => {
    const s = navSections(["SUPER_ADMIN"], false, undefined);
    expect(s.map((x) => x.id)).toEqual(["admin"]);
    expect(s[0].items.map((i) => i.key)).toEqual(["platform", "assets", "tenants", "payment", "subscriptions"]);
  });
});
