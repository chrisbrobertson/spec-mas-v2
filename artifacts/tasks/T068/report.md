## T068 Report

### Summary
- Added API run-control service for `start` and `cancel` flows with persisted run/phase/task state transitions.
- Wired `POST /runs` and `POST /runs/:runId/cancel` endpoints to run control + run query services.
- Added background workflow execution path that invokes workflow executor + OpenHands runtime adapter lifecycle per task.
- Expanded API run query test fixtures and assertions for branch/merge-aware run data and run filtering behavior.

### Changed Files
- `apps/api/src/runControlService.ts`
- `apps/api/src/server.ts`
- `apps/api/src/runQueryService.ts`
- `apps/api/tests/run-control.test.ts`
- `apps/api/tests/run-query-service.test.ts`
- `apps/api/tests/runs-read.test.ts`

### Commands
- `corepack pnpm --filter @specmas/api typecheck`
- `corepack pnpm --filter @specmas/api test:unit`
- `corepack pnpm --filter @specmas/api test:integration`
- `corepack pnpm test:unit`

### Results
- All commands passed.
