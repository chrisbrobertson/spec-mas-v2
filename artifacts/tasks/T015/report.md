# T015 Report

## Summary
Implemented deterministic project registry repository in `packages/core`.

## Implementation
- Added `InMemoryProjectRegistry` with CRUD operations and typed repository interface.
- Added deterministic time injection support for stable timestamps in tests.
- Added duplicate protection by project ID and repository URL.
- Added non-empty input guards and deterministic list ordering.

## Tests
- Updated `packages/core/tests/project-registry.test.ts` with:
  - happy path CRUD coverage
  - failure coverage (duplicate IDs/URLs, unknown updates, invalid inputs)
  - edge coverage (ordering and defensive clone behavior)

## Verification
- Required: `pnpm --filter @specmas/core test:unit -- project-registry`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
