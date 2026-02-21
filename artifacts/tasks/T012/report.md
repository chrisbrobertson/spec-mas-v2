# T012 Report

## Summary
Implemented deterministic config precedence resolution in `packages/config` with merge order:
`global -> project -> env -> cli -> issue-label`.

## Implementation
- Added `CONFIG_PRECEDENCE_ORDER` constant.
- Added per-layer schema normalization before merge.
- Implemented deterministic deep merge behavior (objects merge recursively, arrays replace).
- Kept resolved output validated by `ResolvedConfigSchema`.

## Tests
- Updated `packages/config/tests/precedence.test.ts` with:
  - precedence happy path coverage across all layers
  - failure coverage for invalid override data
  - edge coverage for array replacement and missing required base layers
- Updated `packages/config/tests/inheritance.test.ts` to validate applied layer trace order, including issue-label.

## Verification
- Required: `pnpm --filter @specmas/config test:unit`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
