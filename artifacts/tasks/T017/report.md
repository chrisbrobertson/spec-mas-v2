# T017 Report

## Summary
Implemented deterministic legal state transition validator for run/phase/task states.

## Implementation
- Added transition tables and pure guards in `packages/core/src/stateTransitions.ts`:
  - `isRunTransitionAllowed`
  - `isPhaseTransitionAllowed`
  - `isTaskTransitionAllowed`
- Added assert helpers that reject illegal transitions with deterministic error strings.
- Integrated transition assertions into `runStateRepo` status update methods.

## Tests
- Updated `packages/core/tests/state-transition.test.ts` with:
  - valid transition coverage
  - invalid transition rejection coverage
  - pure guard boolean coverage
- Added run-state repository tests validating illegal transition rejection.

## Verification
- Required: `pnpm --filter @specmas/core test:unit -- state-transition`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
