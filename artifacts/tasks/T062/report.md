# T062 Report

## Summary
Added deployment-mode schema and precedence guardrails requiring v2 app services to run as `local_process` and third-party dependencies to run as `containerized_dependency`.

## Files Updated
- `packages/config/src/schema.ts`
- `packages/config/tests/schema.test.ts`
- `packages/config/tests/precedence.test.ts`

## Verification Commands
```bash
corepack pnpm --filter @specmas/config test:unit -- schema precedence
corepack pnpm --filter @specmas/config lint
corepack pnpm --filter @specmas/config typecheck
```

## Verification Result
- All commands passed.
