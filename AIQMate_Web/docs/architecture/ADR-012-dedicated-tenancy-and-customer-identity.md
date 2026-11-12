# ADR-012: Dedicated deployment per customer group; customers sign in with their own Entra tenants

| Field | Value |
|---|---|
| **ID** | ADR-012 |
| **Status** | Proposed (direction and open items decided by the Product Owner, 2026-11-03) |
| **Date** | 2026-11-03 |
| **Deciders** | Product Owner; Architect to confirm |
| **Relates to** | [ADR-001](./ADR-001-modular-monolith.md), [ADR-011](./ADR-011-web-portal-stack.md), SPEC-023 (identity), SPEC-001 (CI/CD) |

---

## Context

AiQMate will be packaged as a product, web portal and mobile app together, and sold to enterprises.
Today it runs as one deployment in which every user is a B2B guest of a single home tenant
(SPEC-023 §0: `iss` must equal the home tenant; `tid` is non-identifying).

## Decision

### 1. Tenancy: one dedicated deployment per customer group

A **customer** is an enterprise **together with its sister companies**. Each customer gets **its own
deployment**: api-service (including web sign-in), ai-service, the web portal's static files, PostgreSQL, Redis and Blob
storage, in its own resource group (or its own subscription when the customer requires it). Nothing
is shared between customers at runtime.

- **Each sister company is its own organisation (`orgId`)** inside the customer's deployment. The
  data model does not change: everything is already scoped by `orgId`.
- **One set of images for everyone.** Per-customer differences are configuration only (environment,
  Key Vault, App Configuration), never a per-customer build or code branch.
- Provisioning a customer is infrastructure as code (one parameter file per customer).

### 2. Customer identity: multi-tenant Entra app

- AiQMate's Entra app registrations (API, web, mobile) become **multi-tenant**, owned by the
  publisher's tenant (San-Tech).
- Each company's Entra admin **consents once**. Its users sign in as **members of their own tenant**,
  not as guests in ours.
- **A deployment trusts a list of Entra tenants**, one or more per organisation:

  | Setting (per deployment) | Example |
  |---|---|
  | `trustedTenants` | `[{ tenantId: "…", orgId: "org-acme" }, { tenantId: "…", orgId: "org-acme-pumps" }]` |

  token-exchange accepts a token only when its `iss`/`tid` is in that list, still matches the user by
  `oid`, and refuses a user whose `User.orgId` is not the org mapped to that tenant.
- **No automatic account creation stays the rule** (SPEC-023 FR-008): a person needs an AiQMate
  invitation (a `User` row) as well as a valid Entra sign-in. Role and scope still come from
  AiQMate's database, never from token claims.
- Sign-in uses the `organizations` authority (any work account); the tenant check above happens
  after Microsoft returns. A sister company with no tenant of its own uses its parent's tenant.

### 3. Finding a customer's deployment: the AiQMate Directory

One App Store app has to reach many deployments. A small **central AiQMate Directory** service,
run by the publisher, answers *where is this user's deployment, and which version does it run?*

| Lookup by | Returns |
|---|---|
| **Email domain** (`acme.com`, `acmepumps.com`) | the deployment's API base URL, web portal URL, Entra tenant list, deployed version, minimum and maximum mobile app version it supports |
| **Organisation subscription code** (for companies whose users share a public domain, or for a setup link or QR code) | the same |

- The Directory holds **routing and version data only, no customer business data and no user
  records**. It is the only shared runtime component across customers.
- Records are written when a customer is provisioned or upgraded (from the deployment pipeline),
  not by customers.
- The mobile app asks the Directory once at first sign-in, caches the answer, and re-checks on each
  app start, so it notices an upgrade or a move.
- The web portal does not need it: each customer reaches its own portal URL directly.
- The Directory gets **its own spec** (proposed **SPEC-037**), including availability: if it is
  down, already-signed-in phones keep working from the cached answer.

### 4. Versions: the customer controls upgrades, except security fixes

- Each customer **chooses when to upgrade** its deployment to a new release.
- **Security fixes are the exception.** They are released as patch versions on every supported
  release line and **applied by the publisher within an agreed window** (target: critical within
  72 hours), whatever the customer's upgrade schedule.
- **Supported release lines.** The publisher supports a fixed number of recent minor releases
  (proposed: the current one and the two before it). A deployment older than that must upgrade
  before it can get further security patches.
- **The mobile app supports a window of API versions.** Because one store app talks to deployments
  on different versions, it reads the deployment's version (Directory, then `GET /api/v1/version`)
  and:
  - turns off features the deployment's version does not have;
  - shows "Your company's AiQMate needs an update. Contact your administrator." when the deployment
    is older than the app's oldest supported version;
  - asks the user to update the app when the app is older than the deployment's minimum.
- api-service changes stay **backward compatible across the supported window**: additive fields
  and endpoints. A breaking change needs a new endpoint version kept alive across the window.

### 5. Support access: implementation services and central customer support

Two kinds of publisher staff need access to a customer's deployment:

| Who | When | Access |
|---|---|---|
| **Implementation services** | Onboarding and configuration of one customer | Named people, granted for the engagement, removed at hand-over |
| **Central customer support** | After go-live, for any customer | Granted per support case, time-limited |

- Both sign in with their **publisher (San-Tech) Entra accounts**. Each deployment lists the
  publisher tenant as trusted **for support users only**.
- A support user is an AiQMate `User` with a support role, created in the customer's deployment
  **only after the customer's Org Admin approves it**, and expires on a set date.
- Every support sign-in and every change a support user makes is recorded in the identity audit
  trail (`IdentityEvent`), visible to the customer's admins.
- A customer may refuse support access entirely; support then works through screen-sharing.

### 6. What changes, and where it is specified

| Area | Change | Where |
|---|---|---|
| api-service token-exchange | Trusted-tenant list mapped to orgs; publisher tenant for support users only | **SPEC-023 amendment** (to be written) |
| api-service users | Support users: approval by the customer's Org Admin, expiry, audit | SPEC-023 amendment |
| api-service invite flow | Customer members need no Graph guest invite | SPEC-023 amendment |
| api-service versions | Backward compatibility across the supported window; `GET /version` also reports the minimum mobile version | SPEC-023 amendment or SPEC-037 |
| Mobile | Directory lookup at first sign-in, `organizations` authority, version window behaviour | SPEC-037, SPEC-003 |
| Web sign-in | api-service web-auth module (code flow + PKCE) with the trusted-tenant list | ADR-011, SPEC-036 |
| AiQMate Directory | New central service | **SPEC-037** (to be written) |
| Infrastructure and releases | Per-customer stack; release lines; publisher-applied security patches | SPEC-001 follow-up |
| **Super Admin is platform-only** | **Done 2026-11-03** (§7): `PlatformRoleGuard`, `@PlatformScope()`, invite rule | SPEC-036 FR-WEB-013, SPEC-023 note |

### 7. The Super Admin is a platform role with no access to customer data (decided 2026-11-03)

**Rule.** `SUPER_ADMIN` belongs to the company that owns the product. It administers the
**platform**: organisations, subscriptions and seats, and inviting an organisation's Org Admin (or
a fellow Super Admin). It **never** reads a customer's personal data (users, contacts), operational
content (procedures, routines, tasks, inspections, audits, BDAs, evidence, captures, maps, Flix) or
approvals, and never decides them. **Inside an organisation the `ORG_ADMIN` is the administrator**,
and an Org Admin never reaches another organisation (already enforced: `FORBIDDEN_CROSS_ORG`).

**How it is enforced (api-service).**
- **One global guard, deny by default:** `PlatformRoleGuard` runs right after authentication and
  refuses a Super Admin with `403 PLATFORM_ROLE_NO_TENANT_DATA` on every route not marked
  `@PlatformScope()`. This replaces ~40 scattered places where `SUPER_ADMIN` was treated as "admin
  of everything"; those branches are now unreachable for this role and can be removed over time.
- **Allowed routes today:** own account (`/users/me`, its deletion request), `POST /users/invite`,
  `/org`, `/subscription`, `/org/:orgId/subscription/*`. Public routes are unaffected.
- **Invitations:** a Super Admin may invite only `ORG_ADMIN` or `SUPER_ADMIN`; any other role answers
  `403 PLATFORM_ROLE_INVITES_ADMINS_ONLY`. Operational people are invited by their Org Admin.
- **Highest role decides:** whoever's highest role is `SUPER_ADMIN` is platform-only, whatever else
  they hold. Someone who must work inside a customer organisation needs a separate account there
  (§5 support access).
- **Reviewed changes only:** `platform-role.e2e.spec.ts` calls every route of the app as a Super
  Admin and fails if any route outside the reviewed list answers; adding `@PlatformScope()` to a
  route fails it until the list is updated.

**Refined 2026-11-03 (SPEC-038): account data and aggregates are platform data.** For account care
and business development the Super Admin may see, per customer organisation: its profile
(industry, country, website), the **2 to 3 points of contact** the customer agreed to share (the only
personal data the platform role sees), subscription and seats, and **aggregate counts** (users by
status and role, signed in within 30 days, content and task counts, AI usage, feature adoption,
monthly trend). It still never sees a user's identity, any content or title, approvals, or the
activity trail. Usage counts are shared always, under the customer agreement. These routes are
`/platform/**` (`@PlatformScope()` + `@Roles('SUPER_ADMIN')`), listed in `platform-role.e2e.spec.ts`.
The Org Admin gets its own monitoring, activity trail and contacts under `/org-admin/**`, for its
own organisation only.

**Portal.** The menu offers a Super Admin only Platform (insights), Tenants and Subscriptions; the
dashboard sends them to the Platform page without requesting customer data (SPEC-036 FR-WEB-013).

**Still to do.** `/org` and `/subscription` are stubs open to every signed-in role; when they are
built they must be restricted to `SUPER_ADMIN` (`@Roles`). A Super Admin on the **mobile app** now
gets `403` on customer screens; mobile should show the platform message rather than an error
(follow-up). Team members who used the seeded Super Admin account to test customer features in Dev
need an Org Admin (or other tenant-role) account instead.

## Consequences

**Positive**: strong isolation for regulated customers and data residency; each company keeps
control of its own users and sign-in policies (MFA, conditional access); a customer group sees all
its companies in one deployment; customers upgrade on their own schedule.

**Negative / accepted**: cost and operations grow with each customer; several release lines must be
patched in parallel; the mobile app must handle a version window; the Directory is one more service
the publisher runs and must keep highly available.

## Open items

| ID | Question |
|---|---|
| O-1 | Security patch window and number of supported release lines (proposed: critical in 72h; current + 2 minor). Contract terms. |
| O-2 | Can a user belong to more than one sister company (several orgs) in one deployment? Today a `User` has one `orgId`. |
| O-3 | Who hosts the Directory (region, availability target), and is it on the customer's network allow-list? |
