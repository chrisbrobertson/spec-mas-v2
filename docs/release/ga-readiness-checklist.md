# GA Readiness Checklist

## Overview
This checklist defines deterministic go/no-go criteria for Spec-MAS v2 release readiness.

## Prerequisites
- Node.js 22.x installed
- `pnpm` installed
- Workspace dependencies installed via `pnpm install`

## Steps
1. Run lint/typecheck/unit verification.
2. Run integration and deterministic E2E suites.
3. Run migration dry-run tooling from `docs/release/migration-dry-run.sh`.
4. Verify notification and artifact retention policies are configured.
5. Confirm all required workflow pipelines (`validate`, `review`, `plan`, `run`) exist.

## Verification
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`

## Troubleshooting
- If integration fails, run `pnpm test:integration -- <suite-name>` to isolate.
- If E2E snapshots fail, re-check deterministic fixture ordering.
- If migration dry-run fails, ensure `DATABASE_URL` points to a writable SQLite file.
