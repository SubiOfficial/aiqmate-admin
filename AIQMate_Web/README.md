# AiQMate Web Portal

The manager and administrator portal: a React SPA (Vite, React 19, TypeScript, Fluent UI v9,
TanStack Router and Query). Specs: [SPEC-036](docs/specs/036-web-portal/spec.md), [SPEC-038](docs/specs/038-tenant-admin-insights/spec.md), [SPEC-039](docs/specs/039-tenant-metadata/spec.md). Architecture:
[ADR-011](docs/architecture/ADR-011-web-portal-stack.md) (all docs: [docs/](docs/README.md)).

The SPA has **no sign-in code and no per-customer settings of its own**:

- Sign-in, the session cookie and sign-out live in **api-service** (`web-auth` module).
- Settings come from `GET /api/v1/web-auth/config` when the app starts (auth mode, environment,
  whether unbuilt modules show, branding). All `WEB_*` and `WEB_AUTH_*` environment variables are set
  on api-service, not here.

## Run locally

1. Start api-service on `http://localhost:3000`. It lives in the main **AIQMate** repository (`app/api-service`); the portal needs the `web-auth`, `tenant-admin` and `tenant-metadata` modules from branch `web-portal-ver1.0` or later.
2. In this folder:

   ```bash
   npm install
   npm run dev        # http://localhost:5173 (or the next available port)
   ```

The dev server proxies `/api` to `http://localhost:3000`, so the browser only ever talks to the
Vite origin. If port 5173 is occupied, Vite automatically tries the next available port. Cookies
set by api-service land on that origin and no CORS is needed.

### Which sign-in you get

| api-service `AUTH_MODE` | What the portal does |
|---|---|
| `dev` | `/login` shows a role picker. Calls carry `x-user-id: dev-<role>`, `x-org-id: demo-org`, `x-user-role`. Data is the demo-org seed. |
| `entra` | Any page without a session goes to `/api/v1/web-auth/login`, which signs in with Microsoft and sets the `aiq_session` cookie. api-service needs `WEB_AUTH_CLIENT_ID`, `WEB_AUTH_CLIENT_SECRET`, `WEB_AUTH_REDIRECT_URI` set to the Vite origin's callback URL (normally `http://localhost:5173/api/v1/web-auth/callback`) and `WEB_AUTH_API_SCOPE`. If Vite selects another port, update the redirect URI and the registered Entra redirect URI to match. |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 with the `/api` proxy |
| `npm run build` | Typecheck, then build static files into `dist/` |
| `npm run preview` | Serve `dist/` on :5173 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest, once |

## Where things are

| Path | Holds |
|---|---|
| `src/lib/api/client.ts` | `apiFetch`: same-site calls, CSRF header on changes, dev headers, 401 handling |
| `src/lib/api/config.ts` | `/web-auth/config` |
| `src/lib/auth/` | roles, session (`/users/me`), sign-out, sign-in problem messages |
| `src/lib/nav.ts` | **The module list.** Adding a module is a row here plus its route |
| `src/router.tsx` | Routes; everything behind sign-in sits under the `portal` layout |
| `src/components/` | Shell, gates, shared UI |
| `src/pages/` | One file per page |
| `src/theme.ts` | Fluent themes from AiQMate blue `#0058CC` |

## Rules that apply here

- No em dash in any text the portal shows (CLAUDE.md 5h); `src/__tests__/emDashConsistency.test.ts`
  fails the build on drift.
- Text wraps and never clips, from 360px wide to desktop.
- Page role gates are for the user's convenience only; api-service enforces every permission.
- Never keep a token or identity in `localStorage`. Dev-mode identity lives in `sessionStorage`
  and only when api-service runs with `AUTH_MODE=dev`.
