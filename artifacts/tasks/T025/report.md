# T025 Report

## Scope
- Add structured request logging and correlation IDs in API middleware.

## Implemented
- `apps/api/src/logging.ts`: structured logger contract + deterministic correlation ID generator.
- `apps/api/src/server.ts`: request hooks for correlation ID propagation and request/run-event logs.
- `apps/api/tests/logging.test.ts`: happy/failure/edge logging coverage.

## Verification
- Command: `pnpm --filter @specmas/api test:unit -- logging`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` missing and cannot be downloaded in current offline sandbox.
