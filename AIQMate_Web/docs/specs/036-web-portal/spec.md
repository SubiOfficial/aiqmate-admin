# Feature Specification: Web Portal, foundation (SPEC-036)

**Feature Branch**: `agent/web-developer-TBD-web-portal-shell`
**Created**: 2026-11-03
**Status**: Draft, for review (revised 2026-11-03: web sign-in inside api-service, Node.js)
**ADO Work Item**: TBD (to be raised; the branch name takes its ID)
**Diagrams**: [`design.drawio`](design.drawio) — Flow · API Interaction · DB Schema · Cache · Wireframe *(to be drawn after clarification)*
**Architecture**: [ADR-011](../../docs/architecture/ADR-011-web-portal-stack.md) (React SPA; web sign-in in api-service) ·
[ADR-012](../../docs/architecture/ADR-012-dedicated-tenancy-and-customer-identity.md) (dedicated tenancy, customer Entra tenants) ·
[ADR-013](../../docs/architecture/ADR-013-repo-workspace.md) (workspace)
**Amends**: SPEC-001 "React web portal in `web/` … static bundle" (note added there 2026-11-03);
SPEC-023 guard behaviour for cookie-authenticated requests (FR-WEB-006, FR-WEB-007)
**Depends on**: SPEC-023 (token-exchange, Session, `GET /users/me`), SPEC-004 (dashboard API),
SPEC-028 (approvals list). Multi-tenant sign-in waits for the SPEC-023 amendment (ADR-012 §6).

---

## Why this spec exists

AiQMate has two surfaces: the **mobile app** for field work and a **web portal** for managers and
administrators. Only the mobile app has been built, and several specs already place work on "the web
portal" and stop there:

| Spec | Deferred to the web portal |
|---|---|
| SPEC-006 | Hierarchy level setup, CSV import of hierarchy and assets (US-10, US-12), admin edit and soft delete of assets |
| SPEC-009 / SPEC-028 | Supervisor review of submissions waiting for approval |
| SPEC-012 | Audit dashboard (US-010) |
| SPEC-022 | Notification and reminder configuration |
| SPEC-023 | User invite, suspend, reactivate, offboard |

This spec is the **foundation** they all build on: web sign-in in api-service, the SPA, the
role-gated shell and a first dashboard. Each later module is its own spec or amendment and adds one
row to the module list (FR-WEB-030).

## Scope

**In**: the `web-auth` module in api-service; the cookie path in the auth guard; the SPA in
`app/web/`; the shell; who may use the portal; the module list; the dashboard.

**Out**: every module's own screens; multi-tenant Entra and support users (SPEC-023 amendment,
ADR-012); the workspace migration (ADR-013); hosting and CI/CD (SPEC-001 follow-up).

---

## User Scenarios & Testing

### US-001: Sign in with the company Microsoft account (P1)

**As** a supervisor, manager, expert or administrator, **I want** to sign in with my company's
Microsoft account, **so that** my company's own sign-in policies (MFA, conditional access) apply.

- **AC-1**: **Given** nobody is signed in, **when** any portal page opens, **then** the SPA's call to
  `GET /api/v1/users/me` answers `401` and the browser goes to
  `/api/v1/web-auth/login?returnTo=<that path>`.
- **AC-2**: **Given** `/api/v1/web-auth/login`, **then** api-service answers `302` to Microsoft's
  authorize endpoint with `response_type=code`, `code_challenge_method=S256`, a random `state`, and
  sets cookie `aiq_oauth` (signed, `HttpOnly`, 10 minutes).
- **AC-3**: **Given** Microsoft returns to `/api/v1/web-auth/callback` with a `code` and the `state`
  that matches `aiq_oauth`, **then** api-service redeems the code, runs the existing activation
  (token-exchange) logic with `deviceId = "web:<random>"`, sets `aiq_session` and `aiq_xsrf`, clears
  `aiq_oauth`, and answers `302` to `returnTo`.
- **AC-4**: **Given** activation fails with `NOT_INVITED`, `INVITE_EXPIRED` or `INVALID_TOKEN`,
  **then** no session cookie is set and the browser goes to `/sign-in-problem?code=<code>`, which
  shows that code's message (FR-WEB-008).
- **AC-5**: **Given** the `state` is missing, different from `aiq_oauth`, or `aiq_oauth` is expired
  or tampered, **then** the browser goes to `/sign-in-problem?code=SIGN_IN_EXPIRED` and nothing is
  redeemed.
- **AC-6**: **Given** `returnTo` is absolute (`https://…`), protocol-relative (`//…`) or contains a
  backslash, **then** the browser lands on `/dashboard` after sign-in.
- **AC-7**: **Given** a signed-in browser, **then** no response body, script-readable cookie or
  browser storage contains the Entra token or the AiQMate session JWT.
- **AC-8**: **Given** the user already holds 3 active sessions (phones and browsers together),
  **when** they sign in to the portal, **then** sign-in succeeds and the oldest session is revoked
  (SPEC-023 FR-013). If that was a web session, its next call answers `401`.

### US-002: The portal shows each role only what it may use (P1)

- **AC-1**: **Given** a signed-in user, **then** the sidebar lists exactly the modules whose role list
  includes one of the user's roles (FR-WEB-030 table).
- **AC-2**: **Given** a user whose only role is `OPERATOR`, **then** `/no-access` opens; it says the
  work is in the mobile app and offers signing out. No other portal page renders.
- **AC-3**: **Given** `GET /api/v1/web-auth/config` returns `showUnbuilt: false` (Production),
  **then** no unbuilt module appears and `/not-built/<key>` shows the not-found page. **Given**
  `showUnbuilt: true` (Dev, Stage), **then** unbuilt modules appear with a **Soon** marker and open a
  "Not built yet" page naming the module and its source spec.
- **AC-4**: **Given** a user opens a module URL their role does not include, **then** the page shows
  "Your role cannot open this page" with a link to their home page.
- **AC-5** *(2026-11-03, FR-WEB-013)*: **Given** a user whose highest role is `SUPER_ADMIN`, **then**
  they land on `/platform`, the sidebar lists exactly Platform, Organizations and Subscriptions,
  `/dashboard` sends them to `/platform`, and the portal makes no request for customer data.
- **AC-6** *(2026-11-03, FR-WEB-013)*: **Given** a Super Admin calls any api-service route other than
  the platform routes (FR-WEB-013), **then** it answers `403 { code: "PLATFORM_ROLE_NO_TENANT_DATA" }`.
  **Given** an Org Admin calls the same route, **then** the platform rule never refuses it.
- **AC-7** *(2026-11-03, FR-WEB-013)*: **Given** a Super Admin invites a user with a role other than
  `ORG_ADMIN` or `SUPER_ADMIN`, **then** api-service answers
  `403 { code: "PLATFORM_ROLE_INVITES_ADMINS_ONLY" }` and no invitation is created.

### US-003: Dashboard (P1)

- **AC-1**: **Given** any portal role, **then** `/dashboard` shows these tiles from
  `GET /api/v1/dashboard/home` → `kpis`: Open tasks (`tasks.count`, hint "`tasks.inProgress` in
  progress"), Procedures, Routines, Inspections, Breakdown analyses (`bda`), Audits, Area maps.
- **AC-2**: **Given** a role in `ORG_ADMIN | MANAGER | SUPERVISOR`, **then** a
  **Waiting for approval** tile shows `total` from `GET /api/v1/approvals?page=1&limit=1`. For
  `EXPERT` the tile is absent and the request is not sent.
- **AC-3**: **Given** a user whose highest role is `SUPERVISOR`, **then** **Your line** shows
  `GET /api/v1/dashboard/summary` → `kpis.activities`, `kpis.pendingApprovals`, `kpis.assets` and up
  to 5 `recentActivities` (title, status in words, created time). Other roles do not see it.
- **AC-4**: **Given** a request fails with 5xx or the network is down, **then** that section shows
  "The AiQMate service could not be reached." with **Try again**, which repeats the request. A `403`
  shows "Your role cannot read this."
- **AC-5**: **Given** data has not arrived, **then** each tile shows a loading placeholder, not a zero.

### US-004: The session ends when it should (P1)

- **AC-1**: **Given** a signed-in user chooses **Sign out**, **then** the SPA calls
  `POST /api/v1/web-auth/logout` with `X-XSRF-TOKEN`; api-service sets `Session.revokedAt`, expires
  `aiq_session` and `aiq_xsrf`, and answers `204`; the browser lands on `/signed-out`. A later call
  with the old cookie value answers `401`.
- **AC-2**: **Given** the user is suspended, offboarded or has a role change (security stamp bumped),
  **then** the next cookie-authenticated call answers `401 SESSION_REVOKED` and the SPA starts sign-in.
- **AC-3**: **Given** a session 8 hours after sign-in (SPEC-023 FR-012 online lifetime), **then** the
  next call answers `401` and the SPA starts sign-in.
- **AC-4**: **Given** a cookie-authenticated `POST`, `PUT`, `PATCH` or `DELETE` without
  `X-XSRF-TOKEN`, or with a value different from cookie `aiq_xsrf`, **then** api-service answers
  `403 { code: "CSRF_FAILED" }` and makes no change.
- **AC-5**: **Given** a different user signs in in the same browser, **then** no data cached for the
  previous user is shown (the SPA clears its query cache when the user id changes).

### US-005: Local development without Entra (P2, developers)

- **AC-1**: **Given** api-service runs with `AUTH_MODE=dev`, **then** `GET /api/v1/web-auth/config`
  returns `authMode: "dev"`, the SPA shows a role picker, and every call carries `x-user-id:
  dev-<role>`, `x-org-id: demo-org`, `x-user-role: <PascalCase role>`.
- **AC-2**: **Given** `AUTH_MODE=entra`, **then** the SPA shows no role picker and sends no dev
  headers.

---

## Requirements

### api-service: web-auth module
- **FR-WEB-001**: A `web-auth` module in `app/api-service/src/modules/web-auth/` exposes the
  endpoints in § API contracts. It holds no business rules; activation is the identity module's.
- **FR-WEB-002**: Settings, read from the environment: `WEB_AUTH_CLIENT_ID`,
  `WEB_AUTH_CLIENT_SECRET` (Key Vault in deployed environments), `WEB_AUTH_REDIRECT_URI`,
  `WEB_AUTH_API_SCOPE`, `WEB_PORTAL_URL` (where to send the browser after sign-in; empty means the
  same site), `WEB_SHOW_UNBUILT`, `WEB_BRANDING_CUSTOMER_NAME`, `WEB_BRANDING_LOGO_URL`. The authority
  is identity's `ENTRA_AUTHORITY`. With `WEB_AUTH_CLIENT_ID` or `WEB_AUTH_CLIENT_SECRET` unset,
  `/web-auth/login` answers `503 { code: "WEB_SIGN_IN_NOT_CONFIGURED" }`.
- **FR-WEB-003**: Sign-in is the authorization code flow with PKCE (S256) as a confidential client,
  `prompt=select_account`. The Entra token is used only inside api-service for activation; it is
  never sent to the browser. Role comes from `GET /users/me`, never from a token claim.
- **FR-WEB-004**: Cookies:

  | Cookie | Value | Attributes |
  |---|---|---|
  | `aiq_session` | AiQMate session JWT | `HttpOnly; SameSite=Lax; Path=/api; Max-Age=` seconds to the session's online expiry; `Secure` unless `APP_ENV=local` |
  | `aiq_xsrf` | 32 random bytes, base64url | `SameSite=Lax; Path=/; Max-Age` as above; `Secure` unless local; **not** `HttpOnly` |
  | `aiq_oauth` | JWT signed with `JWT_SECRET`: `{ state, verifier, returnTo }`, 10 minutes | `HttpOnly; SameSite=Lax; Path=/api/v1/web-auth; Secure` unless local |

- **FR-WEB-005**: `returnTo` is kept only if it starts with `/`, not `//`, and contains no `\`;
  otherwise `/dashboard`.

### api-service: guard
- **FR-WEB-006**: Under `AUTH_MODE=entra` the guard reads `Authorization: Bearer` first; only when it
  is absent does it read cookie `aiq_session`. Bearer behaviour is unchanged.
- **FR-WEB-007**: For a cookie-authenticated request the guard also: (a) requires the `Session` row
  with `id = jti` to exist, have `revokedAt = null` and `onlineExpiresAt` in the future, else `401
  { code: "SESSION_REVOKED" }`; (b) for `POST`, `PUT`, `PATCH`, `DELETE`, requires header
  `X-XSRF-TOKEN` equal to cookie `aiq_xsrf`, compared in constant time, else `403 { code:
  "CSRF_FAILED" }`.
- **FR-WEB-008**: Sign-in problem codes and the SPA's messages:

  | Code | Message |
  |---|---|
  | `NOT_INVITED` | Your Microsoft account has no AiQMate invitation. Ask your administrator to invite you. |
  | `INVITE_EXPIRED` | Your invitation has expired. Ask your administrator to send a new one. |
  | `INVALID_TOKEN` | Microsoft sign-in could not be verified. Try again. |
  | `SIGN_IN_EXPIRED` | The sign-in took too long or was interrupted. Try again. |
  | `MICROSOFT_ERROR` | Microsoft could not complete the sign-in. Try again. |
  | anything else | Sign-in failed. Try again. |

- **FR-WEB-009**: Each web sign-in uses `deviceId = "web:" + 16 random hex characters` and counts
  toward the user's 3-session limit, shared with mobile (decided 2026-11-03).

### Roles
- **FR-WEB-010**: Roles are the API's `Role` enum. Any casing (`OrgAdmin`, `ORG_ADMIN`) reads as the
  enum value; unknown strings are ignored.
- **FR-WEB-011**: Portal roles: `SUPER_ADMIN`, `ORG_ADMIN`, `MANAGER`, `SUPERVISOR`, `EXPERT`. A user
  whose only role is `OPERATOR` has no portal access.
- **FR-WEB-012**: The displayed role is the highest held: Super Admin > Org Admin > Manager >
  Supervisor > Expert > Operator. Page gates are UI only; api-service enforces every rule.
- **FR-WEB-013** *(2026-11-03, ADR-012 §7)*: **`SUPER_ADMIN` is the product owner's platform role
  and never sees customer data.** A user whose highest role is `SUPER_ADMIN` is platform-only: the
  portal shows only platform modules and api-service's `PlatformRoleGuard` refuses every route not
  marked `@PlatformScope()`. Platform routes: `GET|PUT /users/me`, `GET|POST /users/me/deletion-request`,
  `POST /users/invite` (Org Admin or Super Admin invitees only), `/org`, `/subscription`,
  `/org/:orgId/subscription/*`, and SPEC-038's `/platform/**` (tenant accounts, contacts and
  aggregate counts; never people's data or content). **`ORG_ADMIN` is the only administrator inside an organisation**, and
  never reaches another organisation. `platform-role.e2e.spec.ts` (API) and `nav.test.ts` (portal)
  fail the build if `SUPER_ADMIN` is given a customer-data route or menu entry.

### SPA
- **FR-WEB-020**: The SPA calls `/api/v1/**` on its own site with `credentials: "same-origin"`, adds
  `X-XSRF-TOKEN` from cookie `aiq_xsrf` on `POST`, `PUT`, `PATCH`, `DELETE`, and holds no token.
- **FR-WEB-021**: A non-2xx answer raises `ApiError { status, code, message }` from the `{ code,
  message }` body. A `401` starts sign-in (entra) or returns to the role picker (dev).
- **FR-WEB-022**: Queries are not retried on 4xx; up to 2 retries on 5xx or network failure. Every
  query key includes the signed-in user id.
- **FR-WEB-023**: The SPA has no build-time per-customer settings; it reads `/web-auth/config`.

### Modules
- **FR-WEB-030**: The module list is one table in the SPA (`src/lib/nav.ts`): key, label, path, icon,
  roles, built, summary.

  | Module | Roles | Built |
  |---|---|---|
  | Dashboard | Org Admin, Manager, Supervisor, Expert | ✅ this spec |
  | Platform *(Super Admin home: insights, SPEC-038)* | Super Admin | ✅ |
  | Tenants *(SPEC-038, replaces Organizations)* | Super Admin | ✅ |
  | Monitoring *(SPEC-038)* | Org Admin | ✅ |
  | Activity trail *(SPEC-038)* | Org Admin | ✅ |
  | Company contacts *(SPEC-038)* | Org Admin | ✅ |
  | Approvals | Org Admin, Manager, Supervisor | ⬜ |
  | Hierarchy & Assets | Org Admin | ⬜ |
  | Users | Org Admin | ⬜ |
  | Reports | Org Admin, Manager, Supervisor | ⬜ |
  | Expert Work | Org Admin, Expert | ⬜ |
  | Notifications | Org Admin | ⬜ |
  | Subscriptions | Super Admin | ⬜ |

  *(2026-11-03, FR-WEB-013: Super Admin removed from every customer-data row; Org Admin is the
  admin inside an organisation.)*

- **FR-WEB-031**: An unbuilt row appears only when `showUnbuilt` is true (Dev, Stage), never on
  Production; it is left out, not greyed (the portal's form of CLAUDE.md rule 5i).
- **FR-WEB-032**: Building a module flips its row to `built: true` and points `path` at its page.

### Look and text
- **FR-WEB-040**: Components are Fluent UI v9, themed with AiQMate's palette
  (`app/mobile/src/theme/colors.ts` until ADR-013's `packages/tokens`). Light and dark follow the
  system setting.
- **FR-WEB-041**: No em dash in user-facing text (CLAUDE.md 5h), in the SPA and in the web-auth
  module's messages; tests fail the build on drift.
- **FR-WEB-042**: Layout holds from 360px wide to desktop: the navigation becomes a drawer below
  1024px; tiles reflow to one column below 480px; text wraps, never clips.

### Non-functional
- **NFR-001**: api-service: lint, typecheck and jest pass, including new web-auth and guard tests.
  SPA: lint, typecheck, unit tests and build pass.
- **NFR-002**: The cookie path adds one indexed `Session` lookup by primary key per web request.

---

## API contracts

All paths are under api-service's `/api/v1` prefix.

**`GET /web-auth/config`** (public)
```json
200 {
  "authMode": "entra | dev",
  "environment": "local | dev | stage | prod",
  "showUnbuilt": true,
  "branding": { "customerName": "string | null", "logoUrl": "string | null" }
}
```

**`GET /web-auth/login?returnTo=/path`** (public) → `302 Location: https://login.microsoftonline.com/…/authorize?…`,
`Set-Cookie: aiq_oauth=…`. `503 { "code": "WEB_SIGN_IN_NOT_CONFIGURED" }` when FR-WEB-002 settings
are missing. `400 { "code": "DEV_AUTH_MODE" }` under `AUTH_MODE=dev`.

**`GET /web-auth/callback?code=…&state=…`** (public; Microsoft redirects here)
- success → `302 Location: {WEB_PORTAL_URL}{returnTo}`, `Set-Cookie: aiq_session=…`, `aiq_xsrf=…`,
  `aiq_oauth=; Max-Age=0`
- failure → `302 Location: {WEB_PORTAL_URL}/sign-in-problem?code=<FR-WEB-008 code>`, `aiq_oauth`
  cleared, no session cookie
- `?error=…` from Microsoft → failure with `MICROSOFT_ERROR` (`access_denied` too)

**`POST /web-auth/logout`** (cookie + `X-XSRF-TOKEN`) → `204`, `Session.revokedAt` set, `aiq_session`
and `aiq_xsrf` expired. Without a valid session: `204` and the cookies cleared anyway.

**Used, unchanged:** `GET /users/me` (who is signed in, roles), `GET /dashboard/home`,
`GET /dashboard/summary`, `GET /approvals?page=1&limit=1`. Contracts as in SPEC-023, SPEC-004 and
SPEC-028; summarised in the SPEC-036 history of this file's first draft.

## Data model

**No schema change.** A web session is a row in the existing `sessions` table (SPEC-023):
`id` (= JWT `jti`), `user_id`, `device_id` (`web:…`), `issued_at`, `online_expires_at` (≤ 8h),
`offline_expires_at`, `revoked_at`. The cookie path reads it by primary key (FR-WEB-007).

## Notes for AI Agent

- The `web-auth` module calls `ActivationService.exchangeToken` (via `IdentityService.activate`); it
  never re-implements invitation, status or seat checks.
- Never log, return or put in a URL the Entra token, the authorization code or the session JWT.
- Bearer-token behaviour for mobile must stay byte-for-byte unchanged; every new guard check is
  behind "authenticated by cookie".
- The SPA has no auth code beyond following `401` to `/api/v1/web-auth/login`; no MSAL, no tokens,
  no identity in `localStorage`. Dev-mode identity lives in `sessionStorage` and only when
  `authMode` is `dev`.
- A new module is a row in `src/lib/nav.ts` plus its route, gated by the same roles as its row.
- CLAUDE.md text rules (5e dates by kind, 5f text fits, 5g placeholders, 5h no em dash) apply to the
  portal; mobile-only mechanisms (`AppText`, `PressableFeedback`, haptics, camera) do not.

## Open questions

| ID | Question | Status |
|---|---|---|
| O-36-1 | Web sessions and the 3-session limit | **Decided 2026-11-03: they count** (FR-WEB-009, US-001 AC-8) |
| O-36-2 | Hosting: SPA and `/api/` on one site per customer (ADR-011 §3); pipeline in SPEC-001 follow-up | Open |
| O-36-3 | Which module comes next: Approvals (API exists), Users (SPEC-023 API exists), Hierarchy CSV (SPEC-006, API outstanding)? | Open, PO |
| O-36-4 | Should Manager get an org-wide team view like the supervisor's line view? | Open |
| O-36-5 | An idle timeout for web sessions (e.g. 30 minutes), beyond the 8h online lifetime? | Open |
| O-36-6 | Apply the `Session.revokedAt` check to mobile bearer tokens too, so the 3-session limit and future sign-out take effect at once on phones (ADR-011 § Found while implementing)? | Open, behaviour change for mobile |
| O-36-7 | Web sign-in app registration: a separate confidential web registration, or a secret on the existing API registration? Redirect URI per customer host. | Open, Entra admin |
