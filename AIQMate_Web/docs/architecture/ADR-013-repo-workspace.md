# ADR-013: Repository workspace with separate app packages and small shared packages

| Field | Value |
|---|---|
| **ID** | ADR-013 |
| **Status** | Proposed |
| **Date** | 2026-11-03 |
| **Deciders** | Product Owner (workspace chosen 2026-11-03); Architect to confirm |
| **Relates to** | [ADR-011](./ADR-011-web-portal-stack.md), SPEC-001 |


> **Revised 2026-11-05 (Product Owner): the web portal has its own repository.** The portal is
> pushed to **`AIQMate_Web`** (`https://dev.azure.com/San-Tech-America/AIQMate/_git/AIQMate_Web`),
> with the SPA at the repository root. api-service, ai-service and the mobile app stay in this
> repository, and so do the specs and ADRs (the source of truth; `AIQMate_Web/docs` holds a copy).
> The portal has no build-time dependency on this repository: it talks to api-service only over
> HTTP (`/api/v1`). The shared packages below (`domain`, `api-client`, `tokens`) are therefore
> deferred; if they are built later, they are published as versioned npm packages to the Azure
> Artifacts feed rather than shared through a workspace.

---

## Context

The mobile app and the web portal must stay **separate apps**, built, tested, released and deployed
on their own. But they share facts that are hand-copied today and can drift: roles, the category
allow-list (`app/api-service/src/shared/categories.ts`, mirrored in
`app/mobile/src/models/category.ts`), colours, and API shapes.

## Decision

The repo root becomes an **npm workspace**. Apps stay where they are; shared code goes in `packages/`.

```
package.json            workspaces: ["app/mobile", "app/web", "app/api-service", "app/ai-service", "packages/*"]
app/
  api-service/          NestJS (TypeScript)       own build, image, release
  ai-service/           NestJS (TypeScript)       own build, image, release
  mobile/               Expo / React Native        own build, store release
  web/                  React SPA (Vite)           own build; static files on the customer's portal site
packages/
  domain/               roles, categories, content types, status enums: plain TypeScript, no React
  api-client/           types generated from api-service's OpenAPI document
  tokens/               colours, spacing, type scale as data; mobile and web build their themes from it
```

**Rules**

1. A shared package holds **data and pure functions only**: no React, no React Native, no Node or
   browser APIs. Anything platform-specific stays in its app.
2. An app never imports from another app. Only `packages/*` is shared.
3. Each app keeps its own pipeline, triggered by path filters on its folder plus the packages it uses
   (SPEC-001).
4. `packages/api-client` is generated, never edited by hand. Regenerating it is a script, and CI
   fails when the committed output differs from the API's current OpenAPI document.
5. Web sign-in lives in api-service (ADR-011), so the whole repo is TypeScript and every app is a
   workspace member.

## Migration (its own PR, before web feature work)

1. Root `package.json` with workspaces; one root lockfile.
2. Expo / Metro workspace support (SDK 54 detects monorepos; verify `metro.config.js` and native
   builds on iOS and Android).
3. Move the hand-copied enums into `packages/domain`, one at a time, with tests proving the values
   are unchanged.
4. Full mobile test suite plus an EAS build before merge.

## Consequences

**Positive**: one source for shared facts; web and mobile cannot disagree on a category or role;
API types stop being hand-mirrored.

**Negative / accepted**: a one-off migration that touches mobile's build; root-level install
changes for every developer (documented in CONTRIBUTING.md when done).
