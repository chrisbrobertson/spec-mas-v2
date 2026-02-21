## Overview
- Scope: M1 foundation documentation parity for local full-stack startup, local port map, and local setup verification commands.

## Sources Reviewed
- Implementation/config references:
  - `package.json`
  - `scripts/dev-full.mjs`
  - `apps/web/package.json`
  - `apps/api/src/index.ts`
  - `apps/api/src/runtimeConfig.ts`
  - `docs/release/docker-compose.team.yml`
- Documentation references:
  - `README.md`
  - `docs/release/local-setup.md`

## Parity Findings
- Full-stack start command (`corepack pnpm dev:full`)
  - Implementation: `package.json` defines `dev:full` as `node scripts/dev-full.mjs`; `scripts/dev-full.mjs` starts API and web processes with Corepack/PNPM.
  - Docs: both `README.md` and `docs/release/local-setup.md` instruct `corepack pnpm dev:full` for full-stack start.
  - Status: In parity.

- Port map
  - Web `3000`: implemented in `apps/web/package.json` (`vite ... --port 3000`), documented in `README.md` and `docs/release/local-setup.md`.
  - API `3100`: implemented in `scripts/dev-full.mjs` (`API_PORT=3100`) and reinforced by defaults in `apps/api/src/index.ts` / `apps/api/src/runtimeConfig.ts`; documented in `README.md` and `docs/release/local-setup.md`.
  - Optional sqlite-web `8080`: configured in `docs/release/docker-compose.team.yml`, documented in `README.md` and `docs/release/local-setup.md`.
  - Optional Mailhog `8025/1025`: configured in `docs/release/docker-compose.team.yml`, documented in `README.md` and `docs/release/local-setup.md`.
  - Status: In parity.

- Local setup verification commands
  - `corepack pnpm -r --if-present test:unit`: aligns with root `package.json` (`test:unit` script).
  - `corepack pnpm test:integration`: aligns with root `package.json` (`test:integration` script).
  - `corepack pnpm --filter @specmas/web test:e2e`: aligns with `apps/web/package.json` (`test:e2e` script).
  - Docs location: `docs/release/local-setup.md` (Verification section).
  - Status: In parity.

## Conclusion
- Overall parity status for requested M1 foundation scope: PASS.
- No documentation drift found for the checked startup command, port map, or local verification commands.
