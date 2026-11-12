// SPEC-039 FR-MD-001, FR-MD-009, FR-MD-011: the registry, tenant names and custom-field values.
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { enabledModules, isModuleEnabled, metadataErrorMessage, moduleFields, moduleName } from "@/lib/api/metadata";
import { FIELD_KEY_RE, displayValue, isRealDate, keyFromLabel, parseOptions, toDraft, toPayload } from "@/lib/customFields";
import { FIELD_MODULES, MODULE_KEYS, MODULE_REGISTRY, moduleBySlug, moduleHref } from "@/lib/modules";
import { fieldFixture as field, metadataFixture } from "@/test/metadataFixture";

describe("MODULE_REGISTRY", () => {
  it("has the ten keys, unique slugs and a matching key on every row", () => {
    expect(MODULE_KEYS).toHaveLength(10);
    const slugs = MODULE_KEYS.map((k) => MODULE_REGISTRY[k].slug);
    expect(new Set(slugs).size).toBe(10);
    for (const k of MODULE_KEYS) expect(MODULE_REGISTRY[k].key).toBe(k);
  });

  it("takes custom fields on the five modules the spec names (US-004 AC-1)", () => {
    expect([...FIELD_MODULES]).toEqual(["PROCEDURE", "ROUTINE", "INSPECTION", "TASK", "BDA"]);
  });

  it("finds a module by its slug and builds its href", () => {
    expect(moduleBySlug("tasks")?.key).toBe("TASK");
    expect(moduleBySlug("nope")).toBeUndefined();
    expect(moduleHref("AREA_MAP")).toBe("/work/area-maps");
  });
});

describe("tenant names (FR-MD-011)", () => {
  const meta = metadataFixture(
    {
      PROCEDURE: { singular: "SOP", plural: "SOPs", order: 2 },
      ROUTINE: { singular: "", plural: " ", enabled: false },
      TASK: { singular: "Job", plural: "Jobs", order: 1 },
      INSPECTION: { order: 3 },
    },
    { PROCEDURE: [field({ key: "b", order: 2 }), field({ key: "a", order: 1 }), field({ key: "z", archivedAt: "2026-11-01" })] },
  );

  it("uses the tenant's name, and the standard name when blank or not loaded", () => {
    expect(moduleName(meta, "PROCEDURE", "plural")).toBe("SOPs");
    expect(moduleName(meta, "ROUTINE", "plural")).toBe("Routines");
    expect(moduleName(meta, "GUIDE", "singular")).toBe("Guide");
    expect(moduleName(undefined, "BDA", "plural")).toBe("Breakdown analyses");
  });

  it("lists enabled modules by order", () => {
    expect(enabledModules(meta).slice(0, 3)).toEqual(["TASK", "PROCEDURE", "INSPECTION"]);
    expect(enabledModules(meta)).not.toContain("ROUTINE");
    expect(isModuleEnabled(meta, "ROUTINE")).toBe(false);
    expect(isModuleEnabled(undefined, "GUIDE")).toBe(true);
    expect(enabledModules(undefined)).toHaveLength(10);
  });

  it("returns a module's active fields in order", () => {
    expect(moduleFields(meta, "PROCEDURE").map((f) => f.key)).toEqual(["a", "b"]);
  });

  it("says API codes in words", () => {
    expect(metadataErrorMessage(new ApiError(400, "AT_LEAST_ONE_MODULE", "x"))).toBe("Keep at least one module switched on.");
    expect(metadataErrorMessage(new ApiError(409, "FIELD_LIMIT_REACHED", "x"))).toMatch(/20 active fields/);
    expect(metadataErrorMessage(new ApiError(403, null, "x"))).toBe("Your role cannot make this change.");
    expect(metadataErrorMessage(new Error("x"), "Fallback.")).toBe("Fallback.");
  });
});

describe("custom field values (FR-MD-009)", () => {
  const fields = [
    field({ key: "note", kind: "TEXT" }),
    field({ key: "qty", kind: "NUMBER", required: true }),
    field({ key: "due", kind: "DATE" }),
    field({ key: "zone", kind: "CHOICE", options: ["A", "B"] }),
    field({ key: "ok", kind: "BOOLEAN" }),
  ];

  it("sends numbers as numbers, yes or no as booleans and empty as null", () => {
    const r = toPayload(fields, { note: "  ", qty: "12.5", due: "2026-11-05", zone: "B", ok: true });
    expect(r.errors).toEqual({});
    expect(r.values).toEqual({ note: null, qty: 12.5, due: "2026-11-05", zone: "B", ok: true });
  });

  it("names each field that is wrong or missing", () => {
    const r = toPayload(fields, { note: "x".repeat(501), qty: "", due: "2026-02-30", zone: "C", ok: false });
    expect(Object.keys(r.errors).sort()).toEqual(["due", "note", "qty", "zone"]);
    expect(r.errors.qty).toBe("This field is required.");
    expect(toPayload(fields, { qty: "abc" }).errors.qty).toBe("Enter a number.");
  });

  it("starts a form from stored values", () => {
    expect(toDraft(fields, { qty: 3, ok: true })).toEqual({ note: "", qty: "3", due: "", zone: "", ok: true });
  });

  it("has helpers for dates, keys, options and display", () => {
    expect(isRealDate("2024-02-29")).toBe(true);
    expect(isRealDate("2023-02-29")).toBe(false);
    expect(keyFromLabel("Allergen class (EU)")).toBe("allergen_class_eu");
    expect(keyFromLabel("1st check")).toBe("st_check");
    expect(FIELD_KEY_RE.test("allergen_class")).toBe(true);
    expect(FIELD_KEY_RE.test("Allergen")).toBe(false);
    expect(parseOptions("A\n\n B \nA\r\nC")).toEqual(["A", "B", "C"]);
    expect(displayValue(fields[4], false)).toBe("No");
    expect(displayValue(fields[0], undefined)).toBe("Not set");
  });
});
