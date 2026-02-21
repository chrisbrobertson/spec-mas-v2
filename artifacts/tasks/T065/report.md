# T065 Report

## Summary
Strengthened strict true-E2E local-only assertions to enforce real CLI usage (`codex`, `claude`, `gemini`) and fail on non-mutating/no-op generation outcomes.

## Files Updated
- `packages/test-utils/tests/real-components-full.e2e.test.ts`

## Verification Commands
```bash
RUN_TRUE_E2E=1 RUN_TRUE_E2E_LOCAL_ONLY=1 corepack pnpm --filter @specmas/test-utils exec vitest run tests/real-components-full.e2e.test.ts
```

## Verification Result
- Command executed against real local CLIs and Docker runtime.
- Current run failed in `build-spec` gate (`Missing required section: Overview`), confirming deterministic failure surfacing for invalid generated output.
