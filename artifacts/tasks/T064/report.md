# T064 Report

## Summary
Added integration-matrix coverage validating local app-process + Dockerized dependency profile behavior across config and runtime layers.

## Files Updated
- `packages/test-utils/tests/deployment-profile.integration.test.ts`

## Verification Commands
```bash
corepack pnpm --filter @specmas/test-utils exec vitest run tests/deployment-profile.integration.test.ts
corepack pnpm --filter @specmas/test-utils lint
corepack pnpm --filter @specmas/test-utils typecheck
```

## Verification Result
- All commands passed.
