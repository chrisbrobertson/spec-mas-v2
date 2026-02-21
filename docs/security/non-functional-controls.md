# Non-Functional Security Controls

## Overview
Defines deterministic controls for isolation, reliability, and security regression validation.

## Prerequisites
- Runtime isolation checks implemented in `packages/runtime`.
- Non-functional regression tests implemented in `packages/test-utils`.

## Steps
1. Verify cross-project access protection through unit tests.
2. Run non-functional regression suite with budget thresholds.
3. Review adversarial threshold results.

## Verification
- `pnpm --filter @specmas/runtime test:unit -- isolation`
- `pnpm test:integration -- non-functional`
- `pnpm test:integration -- adversarial`

## Troubleshooting
- If isolation test fails, inspect workspace root and path traversal checks.
- If budget thresholds fail, tune budgets only with documented rationale.
