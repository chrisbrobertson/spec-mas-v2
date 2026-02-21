# Full Delivery Task Board

## Scope
Deliver a real user-runnable local stack with clear ports and one-command startup, then progress to fully integrated user workflows and production readiness:
- Web app on `http://localhost:3000`
- API on `http://localhost:3100`
- Optional team tools unchanged (`sqlite-web` on `8080`, `mailhog` on `8025/1025`)

## M1 Tickets (Foundation)

### M1-T1 Web Runtime Bootstrap
- Status: completed
- Owner: implementation
- Goals:
  - Add real frontend runtime (Vite + React) for `apps/web`
  - Implement route-backed pages for all core areas:
    - `/runs`
    - `/runs/:runId`
    - `/runs/:runId/artifacts`
    - `/runs/:runId/logs`
    - `/authoring`
  - Wire pages to existing domain modules in `apps/web/src/*.ts`
- Files:
  - `apps/web/package.json`
  - `apps/web/index.html`
  - `apps/web/vite.config.ts`
  - `apps/web/src/main.tsx`
  - `apps/web/src/runtime/*`
  - `apps/web/tests/*` (new runtime unit tests)
- Validation:
  - `corepack pnpm --filter @specmas/web test:unit`
  - `corepack pnpm --filter @specmas/web test:e2e`

### M1-T2 API Runtime + Full Stack Scripts
- Status: completed
- Owner: implementation
- Goals:
  - Add executable API runtime entrypoint and startup scripts
  - Add browser-safe CORS defaults for web-on-3000 / api-on-3100
  - Add root scripts for `dev:web`, `dev:api`, `dev:full`
- Files:
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/main.ts`
  - `apps/api/tests/*` (runtime config tests)
  - `package.json`
  - `scripts/dev-full.mjs`
- Validation:
  - `corepack pnpm --filter @specmas/api test:unit`
  - `corepack pnpm -r --if-present test:unit`

### M1-T3 Local Setup and Port Clarity
- Status: completed
- Owner: docs
- Goals:
  - Publish deterministic startup commands and exact port map
  - Document full-stack + optional tools startup/verification
- Files:
  - `docs/release/local-setup.md`
  - `README.md` (quickstart section)
  - `artifacts/qa/docs-parity-report.md`
- Validation:
  - Docs command examples execute successfully in local environment

### M1-T4 QA Sync
- Status: completed
- Owner: qa
- Goals:
  - Run integration-level checks after implementation
  - Record results and any follow-up defects
- Files:
  - `artifacts/qa/integration-report.md`
- Validation:
  - `corepack pnpm test:integration`
  - `corepack pnpm --filter @specmas/web test:e2e`

## M2 Tickets (Usable Product)

### M2-T1 API Contract + Typed Client
- Status: completed
- Owner: implementation
- Goals:
  - Define typed REST contract for runs/artifacts/logs/authoring/auth/session
  - Replace demo-only UI data with API-driven query/mutation layer
  - Add deterministic client-side error/retry handling
- Files:
  - `apps/api/src/runReadModels.ts`
  - `apps/api/src/server.ts`
  - `apps/api/tests/runs-read.test.ts`
  - `apps/web/src/runtime/apiClient.ts`
  - `apps/web/src/runtime/RuntimeApp.tsx`
  - `apps/web/tests/runtime-api-client.test.ts`
  - `README.md`
  - `docs/release/local-setup.md`
  - `artifacts/qa/integration-report.md`
  - `artifacts/qa/docs-parity-report.md`
- Validation:
  - `corepack pnpm --filter @specmas/api test:unit`
  - `corepack pnpm --filter @specmas/web test:unit`
  - `corepack pnpm -r --if-present test:unit`
  - `corepack pnpm -r --if-present test:integration`
  - `corepack pnpm --filter @specmas/web test:e2e`

### M2-T2 Persistence + Bootstrap
- Status: completed
- Owner: implementation
- Goals:
  - Finalize Prisma schema for user-visible entities
  - Add migration + seed flow for local/staging
  - Add startup preflight for DB readiness
- Files:
  - `prisma/schema.prisma`
  - `prisma/migrations/0001_init/migration.sql`
  - `prisma/seed.mjs`
  - `apps/api/src/dbPreflight.ts`
  - `apps/api/src/index.ts`
  - `apps/api/tests/db-preflight.test.ts`
  - `package.json`
  - `scripts/dev-full.mjs`
  - `README.md`
  - `docs/release/local-setup.md`
  - `artifacts/qa/integration-report.md`
  - `artifacts/qa/docs-parity-report.md`
- Validation:
  - `corepack pnpm --filter @specmas/api test:unit`
  - `corepack pnpm --filter @specmas/web test:unit`
  - `corepack pnpm -r --if-present test:unit`
  - `corepack pnpm -r --if-present test:integration`
  - `corepack pnpm --filter @specmas/web test:e2e`

### M2-T3 Auth + Session UX
- Status: completed
- Owner: implementation
- Goals:
  - Implement login/session lifecycle in web app
  - Align role-based UI with backend RBAC
  - Add unauthorized and session-expiry behavior
- Files:
  - `apps/api/src/authService.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/rbac.ts`
  - `apps/api/tests/auth.test.ts`
  - `apps/api/tests/rbac.test.ts`
  - `apps/web/src/runtime/apiClient.ts`
  - `apps/web/src/runtime/authSession.ts`
  - `apps/web/src/runtime/RuntimeApp.tsx`
  - `apps/web/tests/runtime-api-client.test.ts`
  - `apps/web/tests/auth-session.test.ts`
  - `README.md`
  - `docs/release/local-setup.md`
  - `artifacts/qa/integration-report.md`
  - `artifacts/qa/docs-parity-report.md`
- Validation:
  - `corepack pnpm --filter @specmas/api test:unit`
  - `corepack pnpm --filter @specmas/web test:unit`
  - `corepack pnpm -r --if-present test:unit`
  - `corepack pnpm -r --if-present test:integration`
  - `corepack pnpm --filter @specmas/web test:e2e`

### M2-T4 Real Workflow Screens
- Status: completed
- Owner: implementation
- Goals:
  - Convert core routes to real backend-driven flows
  - Runs list/detail + artifacts + live logs + authoring persistence
  - Complete loading/empty/error edge states per route
- Files:
  - `apps/web/src/runtime/RuntimeApp.tsx`
  - `apps/web/src/runtime/apiClient.ts`
  - `apps/web/src/runtime/routeStateMessages.ts`
  - `apps/web/tests/runtime-api-client.test.ts`
  - `apps/web/tests/route-state-messages.test.ts`
  - `README.md`
  - `docs/release/local-setup.md`
  - `artifacts/qa/integration-report.md`
  - `artifacts/qa/docs-parity-report.md`
- Validation:
  - `corepack pnpm --filter @specmas/api test:unit`
  - `corepack pnpm --filter @specmas/web test:unit`
  - `corepack pnpm -r --if-present test:unit`
  - `corepack pnpm -r --if-present test:integration`
  - `corepack pnpm --filter @specmas/web test:e2e`

## M3 Tickets (Production Readiness)

### M3-T1 Realtime + Reliability
- Status: pending
- Owner: implementation
- Goals:
  - Production-grade live log transport (SSE/WebSocket)
  - Reconnect + ordering + dedupe guarantees
  - Failure handling and recovery instrumentation

### M3-T2 Deployment + Operations
- Status: pending
- Owner: platform
- Goals:
  - Dockerized deploy profile for web + api + db
  - Reverse proxy + health probes + logs/metrics integration
  - Staging rollout checklist and rollback playbook

### M3-T3 Quality Gates
- Status: pending
- Owner: qa
- Goals:
  - CI jobs for unit/integration/playwright with gating
  - Accessibility checks and baseline performance budget
  - Regression and release acceptance reports

### M3-T4 Documentation + Runbooks
- Status: pending
- Owner: docs
- Goals:
  - Final user/admin runbooks and troubleshooting
  - Command/flag/output parity checks against implementation
  - Release notes + migration guidance
