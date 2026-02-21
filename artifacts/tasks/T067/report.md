## T067 Report

### Summary
- Replaced API runtime fixture run read-model usage with `RunQueryService` abstraction.
- Added default `PrismaRunQueryService` for persistent run/phase/artifact queries.
- Updated API tests to inject deterministic `InMemoryRunQueryService` data.
- Seeded deterministic run ids (`run-1`, `run-2`) and artifact files for persistent API reads.

### Changed Files
- `apps/api/src/runQueryService.ts`
- `apps/api/src/server.ts`
- `apps/api/tests/runs-read.test.ts`
- `apps/api/tests/run-query-service.test.ts`
- `apps/api/src/runReadModels.ts` (removed)
- `prisma/seed.mjs`

### Commands
- `corepack pnpm --filter @specmas/api test:unit`
- `corepack pnpm --filter @specmas/api test:integration`
- `corepack pnpm test:unit`

### Results
- All commands passed.
