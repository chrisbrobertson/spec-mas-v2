# Local Release Setup

## Overview
This document provides deterministic local setup steps for release validation.

## Prerequisites
- Node.js 22.x
- `pnpm` 9.x
- Docker Desktop (for team profile)

## Steps
1. Install dependencies: `corepack pnpm install`.
2. Bootstrap database: `DATABASE_URL=file:./specmas.db corepack pnpm db:bootstrap`.
3. Build workspace packages: `corepack pnpm build`.
4. Start the local full stack: `corepack pnpm dev:full`.
5. Start team deployment profile (proxy + web + api + optional tools): `docker compose -f docs/release/docker-compose.team.yml up -d`.
6. Run migration dry-run: `docs/release/migration-dry-run.sh`.

## Port Map
- Web UI: `http://localhost:3000`
- API: `http://localhost:3100`
- Proxy API route: `http://localhost:3000/api/health`
- SQLite web (optional): `http://localhost:8080`
- Mailhog UI (optional): `http://localhost:8025`
- Mailhog SMTP (optional): `localhost:1025`

## Verification
- `corepack pnpm -r --if-present test:unit`
- `corepack pnpm test:integration`
- `corepack pnpm --filter @specmas/web test:e2e`
- `curl -s http://localhost:3100/health`
- `curl -s -H 'x-role: viewer' http://localhost:3100/runs`
- `curl -s http://localhost:3000/healthz`
- `curl -s http://localhost:3000/api/health`

## Runtime Notes
- API read endpoints require `x-role` set to one of `viewer|developer|operator|admin`.
- The web runtime uses a typed client (`apps/web/src/runtime/apiClient.ts`) and defaults to API base `http://localhost:3100`.
- API startup now runs DB preflight and fails fast when `DATABASE_URL` is missing, Prisma files are missing, or migrations are unapplied.
- Web runtime now enforces login via `POST /auth/login` before route access.
- Local users are built in for manual testing (`admin`, `operator`, `developer`, `viewer`) and each password matches its username.
- Web auth sessions are persisted in browser local storage, authoring session ids can be restored, and auth sessions expire automatically.
- Live log transport is exposed as `GET /runs/:runId/logs/stream?after=<sequence>` and supports reconnect cursors.

## Troubleshooting
- If Docker services fail, run `docker compose -f docs/release/docker-compose.team.yml config`.
- If proxy routing fails, check `docs/release/nginx.team.conf` and restart `proxy`.
- If builds fail, run `corepack pnpm typecheck` and fix type errors first.
- If `sqlite-web` fails to pull, replace `coleifer/sqlite-web:0.6.4` with `coleifer/sqlite-web:latest` in `docs/release/docker-compose.team.yml`.
