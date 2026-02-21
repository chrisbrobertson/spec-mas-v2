## Overview
- Scope: docs parity re-evaluation for `README.md` and `docs/release/local-setup.md` after recent updates documenting runtime API endpoints and typed client behavior.
- Evaluation date: 2026-02-21.

## Sources Reviewed
- Implementation/config references:
  - `package.json`
  - `scripts/dev-full.mjs`
  - `apps/api/src/main.ts`
  - `apps/api/src/runtimeConfig.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/rbac.ts`
  - `apps/api/src/runReadModels.ts`
  - `apps/api/tests/runs-read.test.ts`
  - `apps/web/src/runtime/config.ts`
  - `apps/web/src/runtime/apiClient.ts`
  - `apps/web/src/runtime/RuntimeApp.tsx`
  - `apps/web/tests/runtime-api-client.test.ts`
- Documentation references:
  - `README.md`
  - `docs/release/local-setup.md`

## Verification Evidence
- Re-validated documentation coverage against current implementation:
  - `README.md` now includes Runtime API Surface details for `GET /runs`, `GET /runs/:runId`, `GET /runs/:runId/artifacts`, and `GET /runs/:runId/logs`.
  - `README.md` now documents protected read endpoint role-header requirements (`x-role: viewer|developer|operator|admin`) and typed client wiring (`apps/web/src/runtime/apiClient.ts`) with default API base `http://localhost:3100`.
  - `docs/release/local-setup.md` Runtime Notes now capture the same role-header requirement and typed client/default base URL behavior.
  - API/runtime implementation remains aligned:
    - endpoint surface in `apps/api/src/server.ts`
    - role parsing/authorization in `apps/api/src/rbac.ts`
    - typed client methods in `apps/web/src/runtime/apiClient.ts`
    - runtime page consumption in `apps/web/src/runtime/RuntimeApp.tsx`
    - default base resolution in `apps/web/src/runtime/config.ts`

## Parity Findings
- Local full-stack commands and verification steps:
  - Status: In parity.
  - Docs and implementation still align for install/start/optional team services and verification flows.

- Port map and API base wiring:
  - Status: In parity.
  - Docs correctly map web `3000`, API `3100`, optional team service ports, and default runtime API base URL behavior.

- Runtime API endpoint and typed-client documentation:
  - Status: In parity.
  - Previous documentation gap is resolved. The current docs now reflect the implemented protected read endpoint surface and typed runtime client behavior.

## Conclusion
- Overall M2 parity status: PASS.
- Final determination: documentation is in sync with implementation for the assessed scope, including runtime API endpoints, role-header semantics, and typed web API client behavior.

## M2-T2 Persistence + Bootstrap Parity Review (2026-02-21)

### Scope
- Verify documentation parity for DB bootstrap and API startup preflight behavior introduced in M2-T2.

### Implementation References
- `apps/api/src/dbPreflight.ts`
- `apps/api/src/index.ts`
- `package.json`
- `scripts/dev-full.mjs`
- `prisma/schema.prisma`
- `prisma/migrations/0001_init/migration.sql`
- `prisma/seed.mjs`

### Documentation References
- `README.md`
- `docs/release/local-setup.md`

### Parity Checks
- Database bootstrap command:
  - Docs specify `DATABASE_URL=file:./specmas.db corepack pnpm db:bootstrap`.
  - Implementation provides `db:bootstrap`, `prisma:migrate:deploy`, and `prisma:seed` scripts with matching default DB URL.
  - Status: PASS.
- API startup preflight behavior:
  - Docs state startup fails fast when `DATABASE_URL` is missing, Prisma files are missing, or migrations are unapplied.
  - Implementation enforces all three checks in `runDatabasePreflight`, wired in API startup path.
  - Status: PASS.
- Local startup command flow:
  - Docs include bootstrap before `corepack pnpm dev:full`.
  - Runtime launcher and `dev:api` script set default DB URL and align with documented flow.
  - Status: PASS.

### Result
- Overall M2-T2 docs parity: PASS.

## M2-T3 Auth + Session UX Parity Review (2026-02-21)

### Scope
- Verify documentation parity for login/session lifecycle and role-aligned UI behavior introduced in M2-T3.

### Implementation References
- `apps/api/src/authService.ts`
- `apps/api/src/server.ts`
- `apps/api/src/rbac.ts`
- `apps/web/src/runtime/RuntimeApp.tsx`
- `apps/web/src/runtime/apiClient.ts`
- `apps/web/src/runtime/authSession.ts`

### Documentation References
- `README.md`
- `docs/release/local-setup.md`

### Parity Checks
- Local login flow:
  - Docs describe `POST /auth/login` and local default users.
  - Implementation provides login endpoint and built-in local users (`admin`, `operator`, `developer`, `viewer`).
  - Status: PASS.
- Session lifecycle behavior:
  - Docs describe browser-stored auth sessions and automatic expiry handling.
  - Implementation persists session in local storage and signs out on expiry/unauthorized conditions.
  - Status: PASS.
- RBAC-aligned UX:
  - Docs note role-based behavior for runtime usage.
  - Implementation enforces read-only authoring sync/create behavior for `viewer`, aligned with backend permissions.
  - Status: PASS.

### Result
- Overall M2-T3 docs parity: PASS.

## M2-T4 Real Workflow Screens Parity Review (2026-02-21)

### Scope
- Verify documentation parity for workflow-screen completeness updates and authoring persistence behavior.

### Implementation References
- `apps/web/src/runtime/RuntimeApp.tsx`
- `apps/web/src/runtime/apiClient.ts`
- `apps/web/src/runtime/routeStateMessages.ts`
- `apps/web/tests/route-state-messages.test.ts`
- `apps/web/tests/runtime-api-client.test.ts`

### Documentation References
- `README.md`
- `docs/release/local-setup.md`

### Parity Checks
- Authoring persistence:
  - Docs state authoring session ids can be restored.
  - Implementation restores stored authoring session ids and loads session details via API.
  - Status: PASS.
- Workflow screen state coverage:
  - Docs emphasize manual-test-ready runtime behavior.
  - Implementation now includes explicit empty/loading/error states across core workflow routes.
  - Status: PASS.

### Result
- Overall M2-T4 docs parity: PASS.

## M3-T1 Realtime + Reliability Parity Review (2026-02-21)

### Scope
- Verify docs parity for SSE live-log transport and reconnect cursor behavior.

### Implementation References
- `apps/api/src/server.ts`
- `apps/api/src/runReadModels.ts`
- `apps/api/tests/runs-read.test.ts`
- `apps/web/src/runtime/apiClient.ts`
- `apps/web/src/runtime/RuntimeApp.tsx`
- `apps/web/tests/runtime-api-client.test.ts`

### Documentation References
- `README.md`
- `docs/release/local-setup.md`

### Parity Checks
- SSE endpoint documentation:
  - Docs now include `GET /runs/:runId/logs/stream?after=<sequence>`.
  - Implementation exposes this endpoint with cursor validation and SSE event payloads.
  - Status: PASS.
- Reconnect cursor semantics:
  - Docs describe reconnect via `after` sequence cursor.
  - Web/API implementation and tests validate incremental delivery based on last seen sequence.
  - Status: PASS.

### Result
- Overall M3-T1 docs parity: PASS.

## M3-T3 Quality Gates Parity Review (2026-02-21)

### Scope
- Verify documentation/automation parity for CI quality-gate workflow coverage.

### Implementation References
- `.github/workflows/ci.yml`
- `.github/workflows/validate.yml`
- `.github/workflows/review.yml`
- `.github/workflows/plan.yml`
- `.github/workflows/run.yml`

### Documentation References
- `docs/release/ga-readiness-checklist.md`

### Parity Checks
- Workflow coverage:
  - GA checklist requires quality-gate pipeline coverage.
  - Workflow files exist for validation, review, planning, and run execution.
  - Status: PASS.

### Result
- Overall M3-T3 docs parity: PASS.
