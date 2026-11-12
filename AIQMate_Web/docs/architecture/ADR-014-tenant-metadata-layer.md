# ADR-014: Industry and tenant metadata on fixed core models

| Field | Value |
|---|---|
| **ID** | ADR-014 |
| **Status** | Accepted (Product Owner, 2026-11-05) |
| **Date** | 2026-11-05 |
| **Deciders** | Product Owner; Architect to confirm |
| **Relates to** | [ADR-012](./ADR-012-dedicated-tenancy-and-customer-identity.md) (one deployment per customer, Super Admin is platform-only), SPEC-006 (renameable equipment labels, `configVersion`), SPEC-036 (web portal), **SPEC-039** (this decision's spec) |

---

## Context

AiQMate is sold to companies in different industries. A food plant calls its procedures "SOPs" and
needs an allergen field; a utility calls its routines "PM schedules" and needs a permit number. The
portal's menus and pages, and the fields a tenant records, should follow the tenant's industry and
the tenant's own wording, not one static vocabulary.

Today Procedure, Routine, Inspection, Activity (Task), BDA, Audit, Guide, Flix, Area map and Capture
are fixed Prisma models. The mobile offline cache (SQLite), the AI pipelines (templates, prompts),
approvals, reports, the purge plan and the demo dataset all depend on those models. SPEC-006 already
lets a tenant rename its two equipment rungs ("Asset", "Subasset") and bumps `configVersion` so a
phone refetches.

## Options considered

| Option | Summary | Verdict |
|---|---|---|
| A. Labels and modules only | Per-tenant names, module on/off and menu order | Too little: no industry fields |
| **B. Metadata layer on fixed models** | A plus per-module custom fields stored as validated JSONB, all seeded from an industry pack | **Chosen** |
| C. Fully dynamic content types | Tenants define new types and schemas | Rejected for now: offline sync, AI, approvals, reports and purge would each need a generic engine; months of work and a much larger test surface |

## Decision

1. **Core models stay fixed.** A tenant changes how a module is **named, shown and extended**, never
   what the module is. Enum keys in the database and the API (`PROCEDURE`, `ROUTINE`...) never
   change; the tenant's words stop at the display edge (the same rule as SPEC-006 labels).
2. **Module registry in code** (`MODULE_REGISTRY`): the ten module keys, their default names, whether
   they take custom fields and where their list comes from. Adding a module is a code change and a
   release, not tenant data.
3. **Industry packs in code, versioned** (`packs/`): a pack sets each module's default names,
   whether it is on, its menu order, and starter custom fields. One image for every customer
   (ADR-012 §1): packs ship with the release, so a customer gets new packs when it upgrades.
   **First pack: General manufacturing**, identical to today's names, and the default for every
   existing organisation, so nothing changes until someone changes it.
4. **Tenant overrides in the database.** `OrgModuleSetting` stores only what a tenant changed (a
   null column means "use the pack"). Effective metadata = pack defaults, then overrides.
5. **Custom fields**: `CustomFieldDef` rows per org and module (text, number, date, choice, yes/no),
   values in a nullable `custom_fields` JSONB column on the content table, validated by the server
   against the definitions on every write. Definitions are archived, never deleted, so old values
   still have a label. Limit 20 active fields per module.
6. **Who configures.** The **Super Admin** picks the industry pack when onboarding a tenant. A pack is
   product configuration, not customer data, so it stays inside the platform role (ADR-012 §7). The
   **Org Admin** tunes names, modules, order and fields for their own organisation. The Super Admin
   never sees a tenant's overrides or field definitions, which can carry customer wording.
7. **Categories, content type visuals and item names do not move.** The five categories (CLAUDE.md
   5a), `CONTENT_TYPE_VISUAL` (5c) and the stored item name (5k) stay global. A tenant renames a
   *module*; it does not get its own categories.
8. **Web first, API ready.** The portal reads `GET /org-metadata` now. The response carries
   `metadataVersion`, bumped in the same transaction as any change, so the mobile app can adopt it
   later the SPEC-006 way (cache, compare on reconnect) without a breaking change.

## Consequences

**Positive**: one product serves several industries by configuration only; tenants use their own
words; new industries are a pack file, not a fork; additive schema (two tables, two columns on
`organizations`, one nullable JSONB column per content table).

**Negative / accepted**: until the mobile app adopts it, a renamed module shows the tenant's name on
the web and the standard name on phones; custom field values are not yet searchable or reportable
(JSONB, indexed later if needed); turning a module off hides it from the portal's menus and pages
but does not block its API in this release (follow-up, SPEC-039 O-39-2).
