# Staging Rollout and Rollback Playbook

## Overview
Deterministic rollout and rollback procedure for the team Docker deployment profile.

## Prerequisites
- Docker engine running
- Repository dependencies installable in containers
- `DATABASE_URL` set when overriding default sqlite path

## Steps
1. Validate compose config: `docker compose -f docs/release/docker-compose.team.yml config`.
2. Start stack: `docker compose -f docs/release/docker-compose.team.yml up -d`.
3. Verify proxy health: `curl -fsS http://localhost:3000/healthz`.
4. Verify API through proxy: `curl -fsS http://localhost:3000/api/health`.
5. Verify web loads via proxy: open `http://localhost:3000` and log in.
6. Capture service status: `docker compose -f docs/release/docker-compose.team.yml ps`.

## Verification
- `docker compose -f docs/release/docker-compose.team.yml config`
- `docker compose -f docs/release/docker-compose.team.yml ps`
- `curl -fsS http://localhost:3000/healthz`
- `curl -fsS http://localhost:3000/api/health`

## Troubleshooting
- If `api` is unhealthy, inspect logs: `docker compose -f docs/release/docker-compose.team.yml logs api`.
- If `web` fails to start, inspect logs: `docker compose -f docs/release/docker-compose.team.yml logs web`.
- If proxy routes fail, verify `docs/release/nginx.team.conf` mapping and restart `proxy`.

## Rollback
1. Stop and remove stack: `docker compose -f docs/release/docker-compose.team.yml down`.
2. Reset to prior image/tag or code revision.
3. Re-run config validation and redeploy previous known-good revision.
4. Re-verify health endpoints and login flow.
