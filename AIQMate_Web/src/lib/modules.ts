// SPEC-039 FR-MD-001. The portal's mirror of api-service MODULE_REGISTRY: the ten fixed module keys,
// their standard names, where a module page reads its list, and whether it takes custom fields.
// A tenant renames a module for display only (ADR-014 §1); keys never change.

export const MODULE_KEYS = [
  "PROCEDURE",
  "ROUTINE",
  "INSPECTION",
  "TASK",
  "GUIDE",
  "BDA",
  "AUDIT",
  "FLIX",
  "AREA_MAP",
  "CAPTURE",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** The `type` filter GET /lookup accepts (LOOKUP_TYPE_FILTERS in api-service). */
export type LookupType = "Procedure" | "Routine" | "Guide" | "Inspection" | "BDA";

export type ModuleSource = { kind: "lookup"; type: LookupType } | { kind: "activities" } | null;

export type ModuleIcon =
  | "procedure"
  | "routine"
  | "inspection"
  | "task"
  | "guide"
  | "bda"
  | "audit"
  | "flix"
  | "areaMap"
  | "capture";

export interface ModuleDef {
  key: ModuleKey;
  /** The path segment of /work/$module. */
  slug: string;
  singular: string;
  plural: string;
  icon: ModuleIcon;
  /** FR-MD-020 / FR-MD-021: null = no portal page yet (shown only where showUnbuilt). */
  source: ModuleSource;
  supportsCustomFields: boolean;
}

export const MODULE_REGISTRY: Readonly<Record<ModuleKey, ModuleDef>> = {
  PROCEDURE: { key: "PROCEDURE", slug: "procedures", singular: "Procedure", plural: "Procedures", icon: "procedure", source: { kind: "lookup", type: "Procedure" }, supportsCustomFields: true },
  ROUTINE: { key: "ROUTINE", slug: "routines", singular: "Routine", plural: "Routines", icon: "routine", source: { kind: "lookup", type: "Routine" }, supportsCustomFields: true },
  INSPECTION: { key: "INSPECTION", slug: "inspections", singular: "Inspection", plural: "Inspections", icon: "inspection", source: { kind: "lookup", type: "Inspection" }, supportsCustomFields: true },
  TASK: { key: "TASK", slug: "tasks", singular: "Task", plural: "Tasks", icon: "task", source: { kind: "activities" }, supportsCustomFields: true },
  GUIDE: { key: "GUIDE", slug: "guides", singular: "Guide", plural: "Guides", icon: "guide", source: { kind: "lookup", type: "Guide" }, supportsCustomFields: false },
  BDA: { key: "BDA", slug: "bda", singular: "Breakdown analysis", plural: "Breakdown analyses", icon: "bda", source: { kind: "lookup", type: "BDA" }, supportsCustomFields: true },
  AUDIT: { key: "AUDIT", slug: "audits", singular: "Audit", plural: "Audits", icon: "audit", source: null, supportsCustomFields: false },
  FLIX: { key: "FLIX", slug: "flix", singular: "Flix video", plural: "Flix", icon: "flix", source: null, supportsCustomFields: false },
  AREA_MAP: { key: "AREA_MAP", slug: "area-maps", singular: "Area map", plural: "Area maps", icon: "areaMap", source: null, supportsCustomFields: false },
  CAPTURE: { key: "CAPTURE", slug: "captures", singular: "Capture", plural: "Captures", icon: "capture", source: null, supportsCustomFields: false },
};

/** FR-MD-003: General manufacturing's menu order, used before metadata has loaded. */
export const DEFAULT_ORDER: readonly ModuleKey[] = MODULE_KEYS;

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && (MODULE_KEYS as readonly string[]).includes(value);
}

export function moduleBySlug(slug: string): ModuleDef | undefined {
  return MODULE_KEYS.map((k) => MODULE_REGISTRY[k]).find((m) => m.slug === slug);
}

export function moduleHref(key: ModuleKey): string {
  return `/work/${MODULE_REGISTRY[key].slug}`;
}

/** Modules whose items can carry custom fields (FR-MD-008, US-004 AC-1). */
export const FIELD_MODULES: readonly ModuleKey[] = MODULE_KEYS.filter((k) => MODULE_REGISTRY[k].supportsCustomFields);
