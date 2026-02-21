# Local Release Setup

## Overview
This document provides deterministic local setup steps for release validation.

## Prerequisites
- Node.js 22.x
- `pnpm` 9.x
- Docker Desktop (for team profile)

## Steps
1. Install dependencies: `corepack pnpm install`.
2. Build workspace packages: `corepack pnpm build`.
3. Start the local full stack: `corepack pnpm dev:full`.
4. Start optional team services: `docker compose -f docs/release/docker-compose.team.yml up -d`.
5. Run migration dry-run: `docs/release/migration-dry-run.sh`.

## Port Map
- Web UI: `http://localhost:3000`
- API: `http://localhost:3100`
- SQLite web (optional): `http://localhost:8080`
- Mailhog UI (optional): `http://localhost:8025`
- Mailhog SMTP (optional): `localhost:1025`

## Verification
- `corepack pnpm -r --if-present test:unit`
- `corepack pnpm test:integration`
- `corepack pnpm --filter @specmas/web test:e2e`

## Troubleshooting
- If Docker services fail, run `docker compose -f docs/release/docker-compose.team.yml config`.
- If builds fail, run `corepack pnpm typecheck` and fix type errors first.
- If `sqlite-web` fails to pull, replace `coleifer/sqlite-web:0.6.4` with `coleifer/sqlite-web:latest` in `docs/release/docker-compose.team.yml`.
