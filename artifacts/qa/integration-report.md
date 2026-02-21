## Overview
- Scope: M1 foundation integration validation for real web runtime, API runtime entry/startup path, and root full-stack scripts.

## Scope
- Web runtime (`apps/web`):
  - `apps/web/package.json`
  - `apps/web/index.html`
  - `apps/web/vite.config.ts`
  - `apps/web/src/main.tsx`
  - `apps/web/src/runtime/RuntimeApp.tsx`
  - `apps/web/src/runtime/routes.ts`
- API runtime/startup (`apps/api`):
  - `apps/api/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/server.ts`
  - `apps/api/src/main.ts`
- Root scripts:
  - `package.json`
  - `scripts/dev-full.mjs`
- Docs:
  - `docs/release/local-setup.md`
  - `README.md`

## Commands
- `corepack pnpm -r --if-present test:integration`
- `corepack pnpm --filter @specmas/web test:e2e`

## Results
- `corepack pnpm -r --if-present test:integration`: PASS across all workspace packages.
- `corepack pnpm --filter @specmas/web test:e2e`: PASS (`5 passed`).
