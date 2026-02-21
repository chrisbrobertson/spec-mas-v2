# T018 Report

## Summary
Implemented internal typed event bus abstraction with in-memory adapter.

## Implementation
- Added event bus interface in `packages/core/src/eventBus.ts`:
  - typed `publish`/`subscribe`
  - typed unsubscribe function
  - `listenerCount` inspection API
- Implemented deterministic in-memory adapter preserving subscription order.
- Ensured publish loop is stable when handlers unsubscribe during dispatch.

## Tests
- Updated `packages/core/tests/event-bus.test.ts` with:
  - ordering happy path
  - failure/behavior path for no-listener and unsubscribe behavior
  - edge coverage for mid-flight unsubscribe ordering

## Verification
- Required: `pnpm --filter @specmas/core test:unit -- event-bus`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
