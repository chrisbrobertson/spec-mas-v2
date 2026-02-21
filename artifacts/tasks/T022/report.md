# T022 Report

## Scope
- Bootstrap dashboard shell with route skeleton and API health ping on load.

## Implemented
- `apps/web/src/app.ts`: route skeleton, dashboard state model, load-time health probe.
- `apps/web/src/index.ts`: module exports.
- `apps/web/tests/app.test.ts`: happy/failure/edge health-load behavior tests.

## Verification
- Command: `pnpm --filter @specmas/web test:unit`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` not installed; Corepack fetch blocked by network policy.
