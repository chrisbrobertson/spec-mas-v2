# T026 Report

## Scope
- Add baseline RBAC role model and deny-by-default middleware.

## Implemented
- `apps/api/src/rbac.ts`: role + permission model with deterministic authorization decisions.
- `apps/api/src/server.ts`: route-level permission guard middleware.
- `apps/api/tests/rbac.test.ts`: allow/deny/public-route and edge-case coverage.

## Verification
- Command: `pnpm --filter @specmas/api test:unit -- rbac`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` unavailable; network restrictions prevent Corepack from installing it.
