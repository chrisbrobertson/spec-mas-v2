# Local npm Runtime Implementation Plan

## Overview
Implement and enforce the deployment rule that Spec-MAS application services run as local npm processes, while Docker is used only for third-party dependencies and runtime backends.

## Prerequisites
- Node.js 22.x
- `pnpm` 9.x via Corepack
- Docker engine available for third-party services
- Existing workspace bootstrapped with `corepack pnpm install`

## Steps
1. **Process Model Contract**
   - Add a runtime contract in code/config that marks Spec-MAS services (`api`, `web`, `worker`) as `local_process`.
   - Add a contract for third-party services (`openhands`, `postgres`, `mailhog`, `sqlite-web`) as `containerized_dependency`.
   - Reject configs that declare Spec-MAS app services as containerized in v2 mode.

2. **Compose Profile Scope**
   - Keep `docs/release/docker-compose.team.yml` limited to third-party services only.
   - Ensure no Spec-MAS app service containers (`api`, `web`, `proxy`) are present.
   - Add/maintain healthchecks for dependency containers.

3. **Local Service Startup**
   - Add or update startup command(s) for local app services (`corepack pnpm dev:full`).
   - Ensure API and web startup are independent from Docker networking assumptions.
   - Ensure orchestration worker startup path is available as local process command.

4. **Runtime Integration Guardrails**
   - Update runtime bootstrap checks to confirm Docker is required only when OpenHands/dependencies are enabled.
   - Ensure OpenHands sandbox lifecycle continues to use Docker containers.
   - Add clear startup errors for invalid deployment mixes.

5. **Test Coverage**
   - Add/adjust tests validating:
     - local-process startup path for Spec-MAS services,
     - Docker-only dependency profile for third-party services,
     - failure on attempted app-service containerization in v2.
   - Keep true E2E validating OpenHands container lifecycle separately from local app process model.

6. **Docs and Operator Runbooks**
   - Align `README.md` and `docs/release/*` with the local-process + third-party-container model.
   - Add troubleshooting paths for local process failures vs container dependency failures.
   - Remove or deprecate proxy/container instructions for app services.

## Verification
- `docker compose -f docs/release/docker-compose.team.yml config`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test:unit`
- `corepack pnpm test:integration`
- `RUN_TRUE_E2E=1 RUN_TRUE_E2E_LOCAL_ONLY=1 corepack pnpm --filter @specmas/test-utils exec vitest run tests/real-components-full.e2e.test.ts`

## Troubleshooting
- If local app services fail, rerun `corepack pnpm dev:full` and inspect stdout/stderr for API/web/worker.
- If dependency containers fail, run `docker compose -f docs/release/docker-compose.team.yml ps` and `docker compose -f docs/release/docker-compose.team.yml logs`.
- If OpenHands lifecycle fails, validate Docker daemon reachability and sandbox image availability before rerunning E2E.
