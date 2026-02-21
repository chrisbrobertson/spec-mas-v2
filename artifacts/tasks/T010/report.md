# T010 Report

## Scope
- Implement API shell baseline with Fastify and `/health` + `/readyz`.

## Implemented
- `apps/api/src/server.ts`: Fastify server bootstrap and health/readiness routes.
- `apps/api/src/index.ts`: startup helper using `createServer`.
- `apps/api/tests/health.test.ts`: deterministic health/readiness endpoint tests.

## Verification
- Command: `pnpm --filter @specmas/api test:unit`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` is unavailable in this environment.
  - Attempting Corepack install (`COREPACK_HOME=/tmp/corepack corepack pnpm -v`) fails due restricted network (`ENOTFOUND registry.npmjs.org`).
