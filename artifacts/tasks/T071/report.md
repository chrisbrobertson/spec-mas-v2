## T071 Report

### Summary
- Replaced fixture-bound Playwright UI checks with real-runtime scenarios that start runs through the API and assert dynamic run IDs.
- Added status-progression assertions from `running` to terminal state and validated branch-scoped run visibility in the dashboard.
- Added real-runtime checks for persisted run logs and artifacts, then validated detail/artifacts/log-stream pages for the created run.
- Fixed a runtime dashboard JSX parse issue (`??` mixed with `||`) that blocked the web UI from loading during E2E execution.

### Changed Files
- `apps/web/tests-e2e/core-ui-workflows.spec.ts`
- `apps/web/src/runtime/RuntimeApp.tsx`

### Commands
- `corepack pnpm --filter @specmas/web exec playwright test -c ../../playwright.web.config.ts --grep real-runtime`
- `corepack pnpm --filter @specmas/web test:unit`
- `corepack pnpm test:unit`

### Results
- All commands passed.
