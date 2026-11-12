# Feature Specification: Industry and tenant metadata (SPEC-039)

**Feature Branch**: `web-portal-ver1.0`
**Created**: 2026-11-05
**Status**: Draft, for review
**ADO Work Item**: TBD
**Diagrams**: [`design.drawio`](design.drawio) — Flow · API Interaction · DB Schema · Cache · Wireframe *(to be drawn after clarification)*
**Depends on**: ADR-014 (decision), ADR-012 §7 (platform role), SPEC-036 (portal shell, nav), SPEC-038 (tenant detail, Org Admin pages), SPEC-005 (Lookup), SPEC-007 (activities), SPEC-006 (label and `configVersion` precedent)

---

## Why this spec exists

The portal's menus and pages are static: every tenant sees "Procedures", "Routines", "Inspections"
and the same fields. Customers in different industries use different words and record different
things. This spec makes the **menus, page titles and extra fields metadata-driven per tenant**,
seeded from an **industry pack**, on the fixed core models (ADR-014).

Decided by the Product Owner on 2026-11-05: metadata layer (names, modules, custom fields), the Super
Admin applies the pack and the Org Admin tunes it, **General manufacturing** is the first pack, and
the web portal uses it first while the API is ready for mobile.

## Terms

| Term | Meaning |
|---|---|
| **Module** | One of the fixed content areas, by key: `PROCEDURE`, `ROUTINE`, `INSPECTION`, `TASK`, `GUIDE`, `BDA`, `AUDIT`, `FLIX`, `AREA_MAP`, `CAPTURE` |
| **Industry pack** | A versioned set of defaults shipped in code: each module's names, on/off, menu order, and starter custom fields |
| **Override** | A tenant's change to a pack default, stored per org and module; null means "use the pack" |
| **Custom field** | A tenant-defined extra field on a module (text, number, date, choice, yes/no) |
| **Effective metadata** | Pack defaults with the tenant's overrides applied, plus active custom fields |

## User Scenarios & Testing

### US-001 Menus and page titles follow the tenant (Priority: P1)

Any signed-in tenant user of the portal sees a **Work** section in the menu listing the enabled
modules, in the tenant's order, named with the tenant's plural names.

**Acceptance Criteria**
1. **Given** an org on General manufacturing with no overrides, **When** an Org Admin opens the
   portal, **Then** the Work section lists Procedures, Routines, Inspections, Tasks, Guides,
   Breakdown analyses in that order (modules with a built page only; see FR-MD-021).
2. **Given** the Org Admin renamed `PROCEDURE` to "SOP" / "SOPs" and moved it below Tasks, **When**
   any portal user of that org reloads, **Then** the menu shows "SOPs" below "Tasks" and the
   page title at `/work/procedures` is "SOPs".
3. **Given** `ROUTINE` is turned off, **When** a user opens the menu, **Then** no Routines entry is
   shown; **When** they open `/work/routines` directly, **Then** the page says the module is turned
   off for their organisation and links to the dashboard; no list request is sent.
4. **Given** a Super Admin, **When** they open the portal, **Then** no `/org-metadata` request is
   sent and no Work section is shown (platform role, ADR-012 §7).

### US-002 A module page lists the tenant's items (Priority: P1)

**Acceptance Criteria**
1. **Given** an Org Admin, Manager or Supervisor, **When** they open a lookup-backed module page
   (`PROCEDURE`, `ROUTINE`, `INSPECTION`, `GUIDE`, `BDA`), **Then** the page calls
   `GET /api/v1/lookup?type=<Type>` and shows Title, Code, Status, Category, Asset, Updated.
2. **Given** the same roles, **When** they open the Tasks page, **Then** it calls
   `GET /api/v1/activities?limit=50` and shows Title, Status, Assigned to, Due, Asset, with
   **Load more** while `nextCursor` is not null.
3. **Given** a list with no rows, **Then** the page says "No <plural name, lower case> yet."
4. **Given** a row is opened, **Then** a side panel shows its core details and the module's custom
   fields (US-005).

### US-003 The Org Admin tunes names, modules and order (Priority: P1)

**Acceptance Criteria**
1. **Given** an Org Admin on `/configuration`, **When** they change a module's singular and plural
   name, its on/off switch or its order and press Save, **Then** `PUT /org-admin/metadata/modules` is
   sent, `metadataVersion` increases by 1, and the menu reflects the change without a reload.
2. **Given** a name equal to the pack default, **When** it is saved, **Then** the stored override
   for that column is null (the module shows as not customised).
3. **Given** all modules switched off, **When** Save is pressed, **Then** the API answers
   `400 AT_LEAST_ONE_MODULE` and nothing changes.
4. **Given** **Reset to pack defaults** is confirmed, **Then** every override of that org is removed,
   `metadataVersion` increases by 1, and custom fields are untouched.
5. **Given** a Manager, Supervisor or Expert, **When** they call any `/org-admin/metadata/*` route,
   **Then** the API answers `403`.

### US-004 The Org Admin defines custom fields (Priority: P1)

**Acceptance Criteria**
1. **Given** an Org Admin, **When** they add a field to a module that supports fields (`PROCEDURE`,
   `ROUTINE`, `INSPECTION`, `TASK`, `BDA`) with a label, key, kind and (for a choice) 2 to 30
   options, **Then** it is created, active, and listed last in that module.
2. **Given** a key already used in that module (active or archived), **Then** `409 FIELD_KEY_EXISTS`.
3. **Given** 20 active fields in the module, **When** another is added or restored, **Then**
   `409 FIELD_LIMIT_REACHED`.
4. **Given** a field, **When** it is archived, **Then** it no longer appears on forms or in
   `GET /org-metadata`, existing values are kept, and it can be restored.
5. **Given** a field, **When** it is edited, **Then** label, required, options, help text and order may
   change; key and kind may not (`400` if sent different).

### US-005 Users record custom field values (Priority: P2)

**Acceptance Criteria**
1. **Given** an Org Admin, Manager or Supervisor viewing an item, **When** they fill custom fields and
   save, **Then** `PUT /content/:moduleKey/:id/custom-fields` stores the values and the panel shows
   them.
2. **Given** a value of the wrong kind (text in a number, a date not `YYYY-MM-DD`, a choice not in the
   options), **Then** `400 INVALID_FIELD_VALUE` naming the field key; nothing is stored.
3. **Given** a required field left empty, **Then** `400 REQUIRED_FIELD_MISSING` naming the key.
4. **Given** an item of another org or an unknown id, **Then** `404 CONTENT_NOT_FOUND`.
5. **Given** an Expert, **When** they open an item, **Then** values are shown read-only; their `PUT`
   answers `403`.

### US-006 The Super Admin applies an industry pack (Priority: P1)

**Acceptance Criteria**
1. **Given** a Super Admin on a tenant's detail page, **When** they pick a pack and confirm, **Then**
   `PUT /platform/tenants/:orgId/pack` sets it, seeds the pack's starter fields that the org does not
   already have (by key), and increases `metadataVersion` by 1.
2. **Given** an org that never had a pack set, **Then** its effective pack is
   `GENERAL_MANUFACTURING` and the detail page shows "General manufacturing".
3. **Given** a pack is applied, **Then** the org's own overrides are kept.
4. **Given** an unknown pack id, **Then** `400 UNKNOWN_PACK`.
5. **Given** a Super Admin, **Then** no response they receive contains the org's overrides or field
   definitions (only the pack id and name).

## Requirements

- **FR-MD-001** Module keys, default names, custom-field support and list source live in one code
  registry (`MODULE_REGISTRY`, api-service; mirrored in `app/web/src/lib/modules.ts`).
- **FR-MD-002** Packs live in code under `src/modules/tenant-metadata/packs/`, each with `id`, `name`,
  `version`, `description`, a row per module (`enabled`, `order`, `singular`, `plural`) and starter
  fields. Every pack must list every registry module exactly once (unit test).
- **FR-MD-003** General manufacturing (`GENERAL_MANUFACTURING`, version 1): all ten modules enabled,
  today's names, order Procedures, Routines, Inspections, Tasks, Guides, Breakdown analyses (BDA),
  Audits, Flix, Area maps, Captures; no starter fields.
- **FR-MD-004** `Organization.industryPack` null means `GENERAL_MANUFACTURING`.
- **FR-MD-005** Effective metadata = pack defaults, then non-null override columns.
- **FR-MD-006** Every write to modules, fields or the pack increases `Organization.metadataVersion`
  by 1 **in the same transaction**.
- **FR-MD-007** Names: trimmed, 1 to 40 characters; a name equal to the pack default is stored as null.
- **FR-MD-008** Field key `^[a-z][a-z0-9_]{1,39}$`; label 1 to 60; help text up to 160; choice options
  2 to 30, each 1 to 60, unique; at most 20 active fields per module.
- **FR-MD-009** Field kinds and value rules: `TEXT` string up to 500; `NUMBER` finite number;
  `DATE` `YYYY-MM-DD` and a real date; `CHOICE` one of the options; `BOOLEAN` true or false. `null`
  clears a value. Unknown or archived keys answer `400 UNKNOWN_FIELD`.
- **FR-MD-010** A value write merges into the stored object; values of archived fields already
  stored are kept.
- **FR-MD-011** The portal's Work menu, module page titles, Monitoring headings and the Configuration
  page use the effective names; Super Admin pages keep the standard names.
- **FR-MD-020** Module pages: lookup-backed `PROCEDURE`, `ROUTINE`, `INSPECTION`, `GUIDE`, `BDA`;
  `TASK` from activities. Roles: Org Admin, Manager, Supervisor, Expert (Expert read-only values).
- **FR-MD-021** `AUDIT`, `FLIX`, `AREA_MAP`, `CAPTURE` have no portal page yet: they appear in the
  Work menu only where `showUnbuilt` is true, with the "Soon" badge, and never in production
  (CLAUDE.md 5i).
- **FR-MD-022** Turning a module off hides it from the portal menu and pages; the API is not blocked
  in this release (O-39-2).
- **FR-MD-030** Purge: `org_module_settings` and `custom_field_defs` are deleted with the org's data.
  Demo reset keeps both (tenant configuration, like `org_settings`).

## API contracts

All under `/api/v1`. Errors use the existing shape `{ statusCode, code, message }`.

### Shared shapes

```ts
type ModuleKey = 'PROCEDURE'|'ROUTINE'|'INSPECTION'|'TASK'|'GUIDE'|'BDA'|'AUDIT'|'FLIX'|'AREA_MAP'|'CAPTURE';
type FieldKind = 'TEXT'|'NUMBER'|'DATE'|'CHOICE'|'BOOLEAN';

interface PackRef { id: string; name: string; version: number }

interface EffectiveModule {
  key: ModuleKey;
  singular: string; plural: string;          // effective names
  enabled: boolean; order: number;           // effective, order 1..10 unique
  defaultSingular: string; defaultPlural: string; defaultEnabled: boolean; defaultOrder: number;
  supportsCustomFields: boolean;
  customised: boolean;                        // any override column non-null
}

interface CustomFieldDto {
  id: string; moduleKey: ModuleKey; key: string; label: string; kind: FieldKind;
  required: boolean; options: string[]; helpText: string | null; order: number;
  source: 'PACK' | 'ORG'; archivedAt: string | null;
}

interface EffectiveMetadata {
  orgId: string; pack: PackRef; metadataVersion: number;
  modules: EffectiveModule[];                          // all ten, sorted by order
  fields: Partial<Record<ModuleKey, CustomFieldDto[]>>; // active only, sorted by order
}
```

### Tenant routes (any tenant role; the Super Admin gets 403 from PlatformRoleGuard)

| Method and path | Roles | Body | 200 | Errors |
|---|---|---|---|---|
| `GET /org-metadata` | any tenant role | | `EffectiveMetadata` | |
| `PUT /org-admin/metadata/modules` | ORG_ADMIN | `{ modules: { key, enabled, order, singular, plural }[] }` (1 to 10 entries, keys unique; modules not listed keep their overrides) | `EffectiveMetadata` | 400 `UNKNOWN_MODULE`, `DUPLICATE_MODULE`, `AT_LEAST_ONE_MODULE`, `INVALID_ORDER` (orders after the change not unique), validation |
| `POST /org-admin/metadata/modules/reset` | ORG_ADMIN | | `EffectiveMetadata` | |
| `GET /org-admin/metadata/fields?includeArchived=true` | ORG_ADMIN | | `CustomFieldDto[]` (all modules, by module then order) | |
| `POST /org-admin/metadata/fields` | ORG_ADMIN | `{ moduleKey, key, label, kind, required?, options?, helpText? }` | 201 `CustomFieldDto` | 400 `MODULE_HAS_NO_FIELDS`, `UNKNOWN_MODULE`, validation; 409 `FIELD_KEY_EXISTS`, `FIELD_LIMIT_REACHED` |
| `PUT /org-admin/metadata/fields/:id` | ORG_ADMIN | `{ label, required, options, helpText, order, key?, kind? }` (key/kind only if unchanged) | `CustomFieldDto` | 400 `FIELD_KEY_IMMUTABLE`, `FIELD_KIND_IMMUTABLE`; 404 `FIELD_NOT_FOUND` |
| `DELETE /org-admin/metadata/fields/:id` | ORG_ADMIN | | 204 (archives) | 404 `FIELD_NOT_FOUND` |
| `POST /org-admin/metadata/fields/:id/restore` | ORG_ADMIN | | `CustomFieldDto` | 404; 409 `FIELD_LIMIT_REACHED` |
| `GET /content/:moduleKey/:id/custom-fields` | ORG_ADMIN, MANAGER, SUPERVISOR, EXPERT | | `{ moduleKey, id, values: Record<string, string\|number\|boolean>, fields: CustomFieldDto[] }` | 400 `MODULE_HAS_NO_FIELDS`, `UNKNOWN_MODULE`; 404 `CONTENT_NOT_FOUND` |
| `PUT /content/:moduleKey/:id/custom-fields` | ORG_ADMIN, MANAGER, SUPERVISOR | `{ values: Record<string, string\|number\|boolean\|null> }` | same as GET | 400 `UNKNOWN_FIELD`, `INVALID_FIELD_VALUE`, `REQUIRED_FIELD_MISSING` (each with `field`); 404 |

Every `/org-admin/**` and `/content/**` query is scoped by the caller's `orgId` from the auth context.

### Platform routes (`@PlatformScope()` + `@Roles('SUPER_ADMIN')`)

| Method and path | Body | 200 | Errors |
|---|---|---|---|
| `GET /platform/packs` | | `{ id, name, version, description, starterFieldCount }[]` | |
| `PUT /platform/tenants/:orgId/pack` | `{ packId }` | `{ orgId, pack: PackRef, metadataVersion }` | 400 `UNKNOWN_PACK`; 404 `TENANT_NOT_FOUND` |

`GET /platform/tenants/:orgId` (SPEC-038) adds `profile.industryPack: PackRef`.

## Data model

```prisma
model Organization {
  // ...existing
  industryPack    String? @map("industry_pack")           // null = GENERAL_MANUFACTURING
  metadataVersion Int     @default(1) @map("metadata_version")
  moduleSettings  OrgModuleSetting[]
  customFields    CustomFieldDef[]
}

model OrgModuleSetting {
  id            String   @id @default(uuid())
  orgId         String   @map("org_id")
  moduleKey     String   @map("module_key")    // validated against MODULE_REGISTRY
  enabled       Boolean?
  sortOrder     Int?     @map("sort_order")
  singularLabel String?  @map("singular_label")
  pluralLabel   String?  @map("plural_label")
  updatedBy     String?  @map("updated_by")
  updatedAt     DateTime @updatedAt @map("updated_at")
  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@unique([orgId, moduleKey])
  @@map("org_module_settings")
}

enum CustomFieldKind { TEXT NUMBER DATE CHOICE BOOLEAN }
enum CustomFieldSource { PACK ORG }

model CustomFieldDef {
  id         String            @id @default(uuid())
  orgId      String            @map("org_id")
  moduleKey  String            @map("module_key")
  fieldKey   String            @map("field_key")
  label      String
  kind       CustomFieldKind
  required   Boolean           @default(false)
  options    String[]          @default([])
  helpText   String?           @map("help_text")
  sortOrder  Int               @map("sort_order")
  source     CustomFieldSource @default(ORG)
  archivedAt DateTime?         @map("archived_at")
  createdAt  DateTime          @default(now()) @map("created_at")
  updatedAt  DateTime          @updatedAt @map("updated_at")
  org Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@unique([orgId, moduleKey, fieldKey])
  @@index([orgId, moduleKey])
  @@map("custom_field_defs")
}

// Values: nullable JSONB on each content table that supports fields.
// Procedure, Routine, Inspection, Activity (TASK), Bda:
//   customFields Json? @map("custom_fields")
```

Migration `20261105120000_tenant_metadata`: additive only (new enums, two tables, two columns on
`organizations`, five nullable JSONB columns).

## Notes for AI Agent

- **Never** rename an enum key, a Prisma model or an API field to the tenant's word. Tenant names are
  display-only.
- Do not touch the five categories, `CONTENT_TYPE_VISUAL` or item naming (CLAUDE.md 5a, 5c, 5k).
- `ROUTINE` and `INSPECTION` both map to the routine/inspection lookup filters `Routine` and
  `Inspection`; `GUIDE` → `Guide`; `BDA` → `BDA`; `PROCEDURE` → `Procedure`.
- Custom-field writes for `INSPECTION` go to the `Inspection` model; `TASK` to `Activity`.
- Add every new `/platform/**` route to `platform-role.e2e.spec.ts`; add the two new tables to
  `ORG_PURGE_PLAN` (before `orgSettings`) and to the demo dataset's `KEEP_TABLES`.
- User-facing strings: no em dash (CLAUDE.md 5h); placeholders describe the field (5g).
- The web caches `GET /org-metadata` in TanStack Query under `['org-metadata', userId]` and
  invalidates it after any Configuration save.

## Open questions

| ID | Question |
|---|---|
| O-39-1 | Which packs come next (Food and beverage, Pharma, Oil, gas and utilities were proposed)? |
| O-39-2 | Should a module that is turned off also be refused by the API (and hidden on mobile)? |
| O-39-3 | Should custom field values be searchable in Lookup and exportable in reports? |
| O-39-4 | Mobile adoption: labels and fields in the app, with `metadataVersion` cached like `configVersion`. |
