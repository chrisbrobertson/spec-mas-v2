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
