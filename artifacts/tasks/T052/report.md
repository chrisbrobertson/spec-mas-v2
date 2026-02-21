# T052 Report

## Scope
- Implement dashboard run list and run detail view models.

## Implemented
- `apps/web/src/runViews.ts`: deterministic run list/detail transformation and phase timeline/badges.
- `apps/web/src/index.ts`: exports for run view module.
- `apps/web/tests/run-views.test.ts`: happy/failure/edge coverage.

## Verification
- Command: `pnpm --filter @specmas/web test:unit -- run-views`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` is unavailable and cannot be installed via Corepack in this sandbox.
