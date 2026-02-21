# Staging Rollout and Rollback Playbook

## Overview
Deterministic rollout and rollback procedure for local npm Spec-MAS services with Dockerized third-party dependencies.

## Prerequisites
- Docker engine running
- Repository dependencies installable locally (`pnpm`)
- `DATABASE_URL` set when overriding default sqlite path

## Steps
1. Validate compose config: `docker compose -f docs/release/docker-compose.team.yml config`.
2. Start third-party services: `docker compose -f docs/release/docker-compose.team.yml up -d`.
3. Start Spec-MAS local processes: `corepack pnpm dev:full`.
4. Verify API health: `curl -fsS http://localhost:3100/health`.
5. Verify web loads: open `http://localhost:3000` and log in.
6. Capture dependency container status: `docker compose -f docs/release/docker-compose.team.yml ps`.

## Verification
- `docker compose -f docs/release/docker-compose.team.yml config`
- `docker compose -f docs/release/docker-compose.team.yml ps`
- `curl -fsS http://localhost:3100/health`
- `curl -fsS http://localhost:3000`

## Troubleshooting
- If API is unhealthy, inspect local logs from the `dev:full` process.
- If web fails to start, inspect local logs from the `dev:full` process.
- If dependency services fail, inspect logs: `docker compose -f docs/release/docker-compose.team.yml logs`.

## Rollback
1. Stop local Spec-MAS processes.
2. Stop dependency containers: `docker compose -f docs/release/docker-compose.team.yml down`.
3. Reset to prior code revision.
4. Re-run config validation and restart dependency containers + local processes.
5. Re-verify health endpoints and login flow.
