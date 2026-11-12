# ADR-011: Web Portal stack: React SPA, with web sign-in inside api-service (Node.js)

| Field | Value |
|---|---|
| **ID** | ADR-011 |
| **Status** | Accepted by the Product Owner, 2026-11-03 (Architect to confirm) |
| **Date** | 2026-11-03 |
| **Feature** | SPEC-036 Web Portal, foundation |
| **Relates to** | [ADR-001](./ADR-001-modular-monolith.md), [ADR-003](./ADR-003-separate-ai-service.md), [ADR-004](./ADR-004-web-dev-target.md), [ADR-012](./ADR-012-dedicated-tenancy-and-customer-identity.md), [ADR-013](./ADR-013-repo-workspace.md), SPEC-001, SPEC-023 |
| **Evidence** | [AiQMate-Backend-Technology-Recommendation.pdf](./AiQMate-Backend-Technology-Recommendation.pdf) (weight, performance, security, maintenance) |

---

## Context

The web portal for managers and administrators has never been built. Every module it will hold
manages the same data the mobile app uses, and api-service (NestJS, Node.js) already enforces the
rules on that data and owns identity: token-exchange, the `Session` table, security stamps and the
3-session limit (SPEC-023).

The product is sold as a dedicated deployment per customer (ADR-012), so each extra service is
multiplied by the number of customers. Enterprise security reviews expect a web app that keeps
tokens out of the browser.

## Options considered

| Option | Verdict |
|---|---|
| Spring Boot (Java) BFF in front of api-service | **Considered, not chosen** (2026-11-03). Strong security framework, but a second language and one more container per customer. The evidence document recommended it for the BFF role; the Product Owner chose one language. |
| Separate NestJS BFF in front of api-service | Not chosen. Same design in Node.js, still one more container per customer. |
| Spring Boot or a second backend owning business rules | Rejected. Two implementations of the same rules would drift (see evidence document). |
| Rewrite api-service in Java | Rejected. No measurable gain for AiQMate; months of rework while mobile depends on it. |
| **Web sign-in as a module inside api-service + React SPA** | **Chosen.** |

## Decision

```
Browser: React SPA (Fluent UI v9)            same site as the API
   │  cookie aiq_session (HttpOnly) + X-XSRF-TOKEN header on changes
   ▼
api-service (NestJS)
   ├─ web-auth module (new): Microsoft sign-in (code flow + PKCE), session cookie, sign-out, portal config
   ├─ identity module (existing): token-exchange, Session rows, users/me, 3-session limit
   └─ every other module, unchanged
   ▼
PostgreSQL (api-service schema, unchanged)
```

### 1. api-service stays Node.js, and owns web sign-in

A new **`web-auth` module** in api-service:

| Concern | How |
|---|---|
| Sign-in | `GET /api/v1/web-auth/login` starts Microsoft's authorization code flow with PKCE as a **confidential client** (`@azure/msal-node`, already a dependency). The client secret comes from Key Vault through the environment, never from source. |
| Callback | `GET /api/v1/web-auth/callback` redeems the code for an access token for the AiQMate API, then calls the **existing** activation (token-exchange) logic, so invitation, status and seat rules are exactly the ones mobile uses. |
| Session | The AiQMate session JWT goes into cookie **`aiq_session`**: `HttpOnly`, `Secure` (except on a laptop), `SameSite=Lax`, `Path=/api`. Script on the page cannot read it. No new session store: the existing `Session` row is the session. |
| Sign-in state | PKCE verifier, state and return path travel in a short-lived signed cookie (`aiq_oauth`, 10 minutes), so no server-side store is needed between redirect and callback. |
| CSRF | Double-submit token: cookie `aiq_xsrf` (readable by the SPA) must equal header `X-XSRF-TOKEN` on every `POST`, `PUT`, `PATCH`, `DELETE` authenticated by the cookie. |
| Revocation | For cookie-authenticated calls the guard also requires the `Session` row (the JWT `jti`) to be neither revoked nor past its online expiry, so **sign-out and the 3-session limit take effect at once** for web sessions. |
| Sign-out | `POST /api/v1/web-auth/logout` revokes the `Session` row and clears the cookies. |
| Portal config | `GET /api/v1/web-auth/config` (public) gives the SPA its per-deployment settings: auth mode, environment, whether unbuilt modules show, branding. One SPA build serves every customer. |

**Mobile is unchanged.** It keeps sending `Authorization: Bearer <session JWT>`. The guard accepts
the bearer header first and falls back to the cookie only when there is no header.

### 2. The SPA (`app/web/`)

| Concern | Choice |
|---|---|
| Build | Vite, React 19, TypeScript strict |
| Routing | TanStack Router |
| Look | **Fluent UI v9** (Microsoft's enterprise design system), themed with AiQMate's palette |
| Server state | TanStack Query against same-site `/api/v1/**` |
| Forms | React Hook Form + Zod, when the first form arrives |
| Tables | AG Grid Community, when the first table arrives |
| Tests | Vitest + Testing Library; Playwright end to end later |
| Auth in the browser | **None.** No MSAL, no token in storage. A `401` sends the browser to `/api/v1/web-auth/login`. |

### 3. Hosting: one site

The SPA and api-service must be **on the same site** for the cookie: in production the customer's
portal host serves the SPA at `/` and routes `/api/` to api-service (ingress or Front Door path
routing). On a laptop the Vite dev server proxies `/api` to api-service on :3000, so no CORS is
needed in any environment. The hosting pipeline is SPEC-001 follow-up work (SPEC-036 O-36-2).

### 4. Local development

With `AUTH_MODE=dev`, `GET /web-auth/config` reports `authMode: "dev"`; the SPA then shows a role
picker and sends the dev-auth headers (`x-user-id`, `x-org-id`, `x-user-role`), as mobile tests do.

## Consequences

**Positive**
- One language (TypeScript) for the whole backend and front end; one toolchain in CI.
- No extra container per customer.
- Web sign-in reuses the exact invitation, status and seat rules mobile uses; nothing is duplicated.
- Tokens never reach page script; cookie plus CSRF is the pattern enterprise reviews expect.

**Negative / accepted**
- api-service now handles browser concerns (cookies, CSRF, redirects) beside its bearer API; the
  `web-auth` module keeps them in one place.
- The SPA and the API must share a site; hosting must route `/api/` to api-service.
- npm supply-chain risk (evidence document §5) applies to the web sign-in code too. Controls:
  `npm ci` from the lockfile, install scripts off in CI, Azure Artifacts upstream feed, dependency
  scanning.

## Found while implementing (2026-11-03)

The 3-session limit (SPEC-023 FR-013) marks the oldest `Session` row revoked, but the guard has
never checked `Session.revokedAt` for bearer tokens, so a revoked **mobile** session keeps working
until its JWT expires (≤ 8h). Web sessions are checked (§1). Whether to apply the same check to
mobile is a behaviour change for the phone and needs its own decision (SPEC-036 O-36-6).

## Supersedes

The Next.js draft and the Spring Boot BFF draft of this ADR (both never merged, 2026-11-03).
