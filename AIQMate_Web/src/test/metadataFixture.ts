// Test helper: General manufacturing effective metadata, with per-module overrides.
import type { CustomFieldDto, EffectiveMetadata, EffectiveModule } from "@/lib/api/metadata";
import { MODULE_KEYS, MODULE_REGISTRY, type ModuleKey } from "@/lib/modules";

export function metadataFixture(
  overrides: Partial<Record<ModuleKey, Partial<EffectiveModule>>> = {},
  fields: Partial<Record<ModuleKey, CustomFieldDto[]>> = {},
): EffectiveMetadata {
  return {
    orgId: "o",
    pack: { id: "GENERAL_MANUFACTURING", name: "General manufacturing", version: 1 },
    metadataVersion: 1,
    modules: MODULE_KEYS.map((key, i) => {
      const d = MODULE_REGISTRY[key];
      return {
        key,
        singular: d.singular,
        plural: d.plural,
        enabled: true,
        order: i + 1,
        defaultSingular: d.singular,
        defaultPlural: d.plural,
        defaultEnabled: true,
        defaultOrder: i + 1,
        supportsCustomFields: d.supportsCustomFields,
        customised: false,
        ...overrides[key],
      };
    }),
    fields,
  };
}

export function fieldFixture(p: Partial<CustomFieldDto>): CustomFieldDto {
  return {
    id: `id-${p.key ?? "f"}`,
    moduleKey: "PROCEDURE",
    key: "f",
    label: "F",
    kind: "TEXT",
    required: false,
    options: [],
    helpText: null,
    order: 1,
    source: "ORG",
    archivedAt: null,
    ...p,
  };
}
