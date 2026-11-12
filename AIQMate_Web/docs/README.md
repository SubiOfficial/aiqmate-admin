# Portal documentation (copy)

The specs and architecture decisions for the portal. **The source of truth is the main AiQMate
repository** (`AIQMate`: `specs/` and `docs/architecture/`), where api-service and the mobile app
live too; these copies are refreshed when they change there.

| Document | What it covers |
|---|---|
| [ADR-011](architecture/ADR-011-web-portal-stack.md) | Portal stack: React SPA, sign-in inside api-service |
| [ADR-012](architecture/ADR-012-dedicated-tenancy-and-customer-identity.md) | One deployment per customer, multi-tenant Entra, Super Admin is platform-only |
| [ADR-013](architecture/ADR-013-repo-workspace.md) | Repositories (revised 2026-11-05: the portal has its own repository) |
| [ADR-014](architecture/ADR-014-tenant-metadata-layer.md) | Industry and tenant metadata on fixed core models |
| [SPEC-036](specs/036-web-portal/spec.md) | Portal foundation: sign-in, shell, roles, dashboard |
| [SPEC-038](specs/038-tenant-admin-insights/spec.md) | Tenant administration and insights |
| [SPEC-039](specs/039-tenant-metadata/spec.md) | Industry and tenant metadata: Work menu, module pages, Configuration |
