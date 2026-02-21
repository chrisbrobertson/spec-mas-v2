## T070 Report

### Summary
- Added API runtime readiness evaluation that validates Docker availability, runtime bootstrap profile compatibility, and OpenHands image presence for OpenHands-enabled modes.
- Added protected `GET /runtime/readiness` endpoint to surface deterministic readiness results for manual stack checks.
- Added run-start guardrail in `POST /runs` to fail fast with `503` and structured readiness details when runtime prerequisites are not met.
- Added unit coverage for readiness endpoint auth behavior and run-start readiness failure path.

### Changed Files
- `apps/api/src/runtimeReadiness.ts`
- `apps/api/src/server.ts`
- `apps/api/tests/runtime-readiness.test.ts`
- `apps/api/tests/run-control.test.ts`

### Commands
- `corepack pnpm --filter @specmas/runtime test:unit -- bootstrap`
- `corepack pnpm --filter @specmas/test-utils test:integration -- deployment-profile`
- `corepack pnpm test:unit`

### Results
- All commands passed.
