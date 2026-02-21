# T016 Report

## Summary
Implemented run/phase/task state repositories and typed status enums.

## Implementation
- Added typed enums and records in `packages/core/src/domain.ts`.
- Implemented repository interfaces and in-memory implementation in `packages/core/src/runStateRepo.ts`:
  - run, phase, and task creation/read/update/list operations
  - hierarchy integrity checks (run/phase/task relationship validation)
  - deterministic timestamp behavior with injectable clock

## Tests
- Updated `packages/core/tests/run-state.test.ts` with:
  - happy path status updates
  - failure coverage for invalid hierarchy and illegal references
  - edge coverage for deterministic ordering and timestamp reset behavior

## Verification
- Required: `pnpm --filter @specmas/core test:unit -- run-state`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
