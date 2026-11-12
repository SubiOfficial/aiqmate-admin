# Feature Specification: Tenant administration and insights (SPEC-038)

**Feature Branch**: `web-portal-ver1.0`
**Created**: 2026-11-03
**Status**: Draft, for review
**ADO Work Item**: TBD
**Diagrams**: [`design.drawio`](design.drawio) — Flow · API Interaction · DB Schema · Cache · Wireframe *(to be drawn after clarification)*
**Depends on**: SPEC-036 (web portal, FR-WEB-013 platform role), ADR-012 §7 (Super Admin is platform-only), SPEC-023 (users, IdentityEvent), SPEC-007 (activities), SPEC-024/SPEC-028 (content revisions, approvals)
**Amends**: ADR-012 §7 (what the platform role may see: account data and aggregates, never content or individuals)

---

## Why this spec exists

Two administrators need two different views:

- **The Super Admin** (San-Tech, the product owner) maintains customer accounts and develops the
  business: who the customer is, whom to call, whether the subscription and seats are healthy, and
  how much of the product each customer really uses. That informs product improvement and the
  selling story.
- **The Org Admin** (the customer) runs their own organisation: how procedures, routines and tasks
  are moving, and who did what, when.

ADR-012 §7 keeps the Super Admin away from customer data. This spec draws the line precisely.

## What the Super Admin may and may not see (decided 2026-11-03)

| Super Admin MAY see | Super Admin may NOT see |
|---|---|
| The organisation's profile: name, industry, country, website | Any user's name, email or activity (except the contacts below) |
| **2 to 3 points of contact** the customer agreed to share, maintained with the customer | Procedure, routine, task, audit, BDA, evidence, map or Flix **content or titles** |
| Subscription status, trial end, seats limit and used | Approvals and their decisions |
| **Aggregate counts** per organisation: users by status and role, signed in within 30 days, content counts by status, tasks created and completed, AI jobs and cost, monthly trend | The activity trail (FR-TAI-030) |

Usage counts are shared **always**, under the customer agreement (decided 2026-11-03: no opt-out
switch in the app). They are counts only; no row-level data leaves the organisation's scope.

**Deployment shape (decided 2026-11-03):** built inside api-service now, so it covers every
organisation **in one deployment** (Dev, Stage, or a customer group with sister companies). The
cross-customer view arrives with the central AiQMate Directory (SPEC-037), which will pull the same
`UsageReport` from each customer deployment. The contract below is that report.

---

## User Scenarios & Testing

### US-001: Super Admin sees every tenant at a glance (P1)

- **AC-1**: **Given** a Super Admin, **when** they open **Tenants**, **then** the portal lists every
  organisation except the platform organisation (`isPlatformOrg = true`), each with name, subscription
  status, trial end, seats used of limit, primary contact, users signed in within 30 days, last
  activity date, and health.
- **AC-2**: **Given** an organisation whose trial ends within 7 days, **then** its health is
  `ATTENTION` with reason `TRIAL_ENDING_SOON`. Other reasons: `TRIAL_EXPIRED` (trial end passed),
  `SEATS_NEARLY_FULL` (used ≥ 90% of limit), `NO_RECENT_ACTIVITY` (no activity event and no sign-in in
  30 days), `FEW_CONTACTS` (fewer than 2 contacts). No reason: `OK`.
- **AC-3**: **Given** any tenant row, **then** the response contains no user name or email other than
  the organisation's contacts, and no content title.

### US-002: Super Admin maintains a tenant's profile and contacts (P1)

- **AC-1**: **Given** a tenant, **when** the Super Admin saves industry, country and website, **then**
  `PUT /platform/tenants/:orgId/profile` stores them and the detail page shows them.
- **AC-2**: **Given** a tenant with fewer than 3 contacts, **when** the Super Admin adds one with name,
  email and type (title and phone optional), **then** it is saved. **Given** 3 contacts already,
  **then** adding answers `409 { code: "CONTACT_LIMIT_REACHED" }`.
- **AC-3**: **Given** a tenant already has a `PRIMARY` contact, **when** another contact is saved as
  `PRIMARY`, **then** the answer is `409 { code: "PRIMARY_CONTACT_EXISTS" }`.
- **AC-4**: **Given** an invalid email, **then** the answer is `400` and nothing is saved.
- **AC-5**: **Given** a contact, **when** it is edited or deleted, **then** the change is saved and the
  list reflects it.

### US-003: Super Admin reads a tenant's usage and the platform insights (P1)

- **AC-1**: **Given** a tenant, **when** the Super Admin opens it, **then** they see its `UsageReport`:
  users by status and by role, signed in within 30 days; procedures, routines, inspections, tasks,
  audits and BDAs by state and in the last 30 days; AI jobs and estimated cost this month against the
  cap; which features it has used; a 6-month trend.
- **AC-2**: **Given** the Super Admin opens **Platform**, **then** they see platform insights across
  all tenants: tenants by subscription status, seats used of limit, users signed in within 30 days,
  feature adoption (how many tenants use each feature), AI jobs and cost this month, a 6-month trend,
  and the tenants needing attention.

### US-004: Org Admin monitors their organisation (P1)

- **AC-1**: **Given** an Org Admin, **when** they open **Monitoring**, **then** they see for their own
  organisation only: procedures by status (Draft, Pending approval, Published, Archived) and published
  in the last 30 days; routines Active and Inactive, and inspections published; tasks by status
  (Open, In progress, Submitted for review, Redo required), overdue, created and completed in the
  last 30 days; a 6-month trend of tasks created and completed and procedures published.
- **AC-2**: **Given** a task with a due date in the past and status Open, In progress or Redo
  required, **then** it counts as overdue.
- **AC-3**: **Given** any role other than `ORG_ADMIN`, **then** `/org-admin/*` answers `403`.

### US-005: Org Admin traces who did what (P1)

- **AC-1**: **Given** an Org Admin opens **Activity trail**, **then** they see their organisation's
  events newest first, merged from task events, identity events, content revisions and audit status
  changes, each with time, who, what happened, and the item it concerns.
- **AC-2**: **Given** a source filter (`TASK`, `PEOPLE`, `CONTENT`, `AUDIT`) or a date range, **then**
  only matching events are listed, 50 per page.
- **AC-3**: **Given** an event from another organisation, **then** it never appears.

### US-006: Org Admin keeps their company contacts current (P2)

- **AC-1**: **Given** an Org Admin, **then** they can list, add, edit and delete their own
  organisation's contacts under the same rules as US-002 AC-2..AC-4.
- **AC-2**: **Given** a contact id from another organisation, **then** the answer is `404`.

---

## Requirements

- **FR-TAI-001**: Platform endpoints live under `/platform/**`, carry `@PlatformScope()` and
  `@Roles('SUPER_ADMIN')`, and are added to `platform-role.e2e.spec.ts`'s reviewed list.
- **FR-TAI-002**: Org Admin endpoints live under `/org-admin/**`, carry `@Roles('ORG_ADMIN')`, and
  read the organisation **only** from the auth context, never from the request.
- **FR-TAI-003**: One `OrgMetricsService` computes the counts for both audiences, so the Super Admin's
  report and the Org Admin's overview cannot disagree.
- **FR-TAI-004**: The Super Admin's responses carry counts, organisation fields and contacts only.
  A test asserts no user name, email (other than contacts) or content title appears.
- **FR-TAI-010**: Contacts: at most 3 per organisation; at most one `PRIMARY`; `contactType` in
  `PRIMARY | BILLING | TECHNICAL | OTHER`; `name` 1–120 chars; `email` valid; `title` ≤ 120;
  `phone` ≤ 40.
- **FR-TAI-020**: "Signed in within 30 days" counts users whose `lastLoginAt` is within 30 days.
  "Last activity" is the latest of any `ActivityEvent.occurredAt` and any `User.lastLoginAt` in the org.
- **FR-TAI-021**: Monthly trends cover the current and the 5 previous calendar months (UTC).
- **FR-TAI-030**: The activity trail is visible to the Org Admin only. Entries:
  `{ id, occurredAt, source, action, summary, actor: { id, name }, subject: { type, id, title } }`,
  `summary` a plain sentence with no em dash.
- **FR-TAI-040**: The portal adds **Tenants** (Super Admin), makes **Platform** the insights page,
  and adds **Monitoring** and **Activity trail** and **Company contacts** (Org Admin) to the module
  list (SPEC-036 FR-WEB-030).

---

## API contracts

All under `/api/v1`. `Contact`:
```json
{ "id": "uuid", "name": "string", "title": "string|null", "email": "string", "phone": "string|null",
  "contactType": "PRIMARY|BILLING|TECHNICAL|OTHER", "updatedAt": "ISO" }
```
`ContactInput` (POST, PUT): `{ name, title?, email, phone?, contactType }`.

### Super Admin

**`GET /platform/tenants`** → `200 { "items": TenantSummary[] }`
```json
TenantSummary {
  "orgId": "string", "name": "string", "industry": "string|null", "country": "string|null",
  "subscription": { "status": "TRIAL|ACTIVE|EXPIRED", "trialEndsAt": "ISO|null" },
  "seats": { "limit": 10, "used": 7 },
  "primaryContact": "Contact|null", "contactCount": 2,
  "activeUsers30d": 5, "lastActivityAt": "ISO|null",
  "health": "OK|ATTENTION", "reasons": ["TRIAL_ENDING_SOON|TRIAL_EXPIRED|SEATS_NEARLY_FULL|NO_RECENT_ACTIVITY|FEW_CONTACTS"]
}
```
**`GET /platform/tenants/:orgId`** → `200 { "tenant": TenantSummary, "profile": { "industry", "country", "website" }, "contacts": Contact[], "usage": UsageReport }`; `404 { code: "TENANT_NOT_FOUND" }`.
```json
UsageReport {
  "generatedAt": "ISO",
  "users": { "active": 0, "invited": 0, "suspended": 0, "deactivated": 0, "activeLast30d": 0,
             "byRole": { "ORG_ADMIN": 0, "MANAGER": 0, "SUPERVISOR": 0, "OPERATOR": 0, "EXPERT": 0 } },
  "content": OrgOverview (below, without "generatedAt"),
  "ai": { "month": "2026-11", "jobs": 0, "estCostUsd": 0, "capUsd": null },
  "adoption": { "procedures": true, "routines": false, "inspections": false, "tasks": true, "audits": true, "bda": true, "ai": false }
}
```
**`PUT /platform/tenants/:orgId/profile`** body `{ industry?, country?, website? }` (each ≤ 120, website a URL) → `200 { profile }`.
**`POST /platform/tenants/:orgId/contacts`** → `201 { contact }`; **`PUT …/contacts/:contactId`** → `200 { contact }`; **`DELETE …/contacts/:contactId`** → `204`. Errors: `400`, `404 CONTACT_NOT_FOUND`, `409 CONTACT_LIMIT_REACHED | PRIMARY_CONTACT_EXISTS`.
**`GET /platform/insights`** →
```json
{ "generatedAt": "ISO",
  "tenants": { "total": 0, "trial": 0, "active": 0, "expired": 0 },
  "seats": { "limit": 0, "used": 0 },
  "users": { "active": 0, "activeLast30d": 0 },
  "adoption": [ { "feature": "procedures", "tenantsUsing": 0 } ],
  "ai": { "month": "2026-11", "jobs": 0, "estCostUsd": 0 },
  "monthly": [ { "month": "2026-06", "tasksCreated": 0, "tasksCompleted": 0, "proceduresPublished": 0 } ],
  "attention": TenantSummary[] }
```

### Org Admin (own organisation)

**`GET /org-admin/overview`** →
```json
OrgOverview {
  "generatedAt": "ISO",
  "procedures": { "draft": 0, "pendingApproval": 0, "published": 0, "archived": 0, "publishedLast30d": 0 },
  "routines": { "active": 0, "inactive": 0, "inspectionsPublished": 0 },
  "tasks": { "open": 0, "inProgress": 0, "submittedForReview": 0, "redoRequired": 0, "overdue": 0,
             "createdLast30d": 0, "completedLast30d": 0 },
  "audits": { "total": 0, "last30d": 0 }, "bdas": { "total": 0, "last30d": 0 },
  "monthly": [ { "month": "2026-06", "tasksCreated": 0, "tasksCompleted": 0, "proceduresPublished": 0 } ]
}
```
**`GET /org-admin/trail?page=1&limit=50&source=TASK|PEOPLE|CONTENT|AUDIT&from=ISO&to=ISO`** →
`200 { "items": TrailEntry[], "page": 1, "limit": 50, "total": 0 }`, `limit` ≤ 100.
**`GET /org-admin/contacts`** → `200 { "items": Contact[] }`; **`POST`**, **`PUT /:contactId`**, **`DELETE /:contactId`** as the platform contact routes.

## Data model

```prisma
enum OrgContactType { PRIMARY BILLING TECHNICAL OTHER }

model OrgContact {
  id          String         @id @default(uuid())
  orgId       String         @map("org_id")
  name        String
  title       String?
  email       String
  phone       String?
  contactType OrgContactType @map("contact_type")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")
  updatedBy   String?        @map("updated_by")
  @@index([orgId])
  @@map("org_contacts")
}
// organizations: + industry String?, country String?, website String? (nullable, additive)
```
Migration is additive only. No existing column changes.

## Notes for AI Agent

- Never return a user's name or email in a `/platform/**` response. Contacts are the only people data.
- `/org-admin/**` takes the org from `req.authContext.orgId`; there is no `orgId` parameter.
- Trail names: resolve `actorId` to a display name within the same org only.
- Reuse the existing counting predicates where they exist (dashboard service); keep "overdue"
  exactly as AC-2 defines it.

## Open questions

| ID | Question | Status |
|---|---|---|
| O-38-1 | Central aggregation across customer deployments (SPEC-037) | Later, decided 2026-11-03 |
| O-38-2 | Should the Super Admin export the tenant list (CSV) for CRM? | Open |
| O-38-3 | Retention of the activity trail sources (they grow without limit today) | Open |
