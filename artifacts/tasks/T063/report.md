# T063 Report

## Summary
Implemented runtime bootstrap guardrails to:
- validate v2 deployment profile combinations, and
- require Docker only when OpenHands or containerized dependencies are enabled.

## Files Updated
- `packages/runtime/src/bootstrap.ts`
- `packages/runtime/src/index.ts`
- `packages/runtime/tests/bootstrap.test.ts`

## Verification Commands
```bash
corepack pnpm --filter @specmas/runtime exec vitest run tests/bootstrap.test.ts
corepack pnpm --filter @specmas/runtime lint
corepack pnpm --filter @specmas/runtime typecheck
```

## Verification Result
- All commands passed.
