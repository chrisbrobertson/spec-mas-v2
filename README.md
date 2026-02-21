# Spec-MAS v2

Spec-MAS v2 is a specification-first multi-agent orchestration design centered on local OpenHands execution, GitHub Issues as the work queue, and artifact-driven validation.

## Repository Layout
- `specs/spec-mas-v2-definition.md`: Canonical end-to-end v2 definition.
- `specs/reference-map.md`: Shared source reference IDs (`SRC-*`) used by split specs.
- `specs/features/`: Individual feature specs.
- `specs/architecture/`: Individual architecture specs.
- `specs/validation/`: Individual testing and validation specs.

## How To Read
1. Start with `specs/spec-mas-v2-definition.md` for full context.
2. Use `specs/reference-map.md` for canonical section mapping.
3. Use split specs in `specs/features/`, `specs/architecture/`, and `specs/validation/` for focused work.

## Local Full Stack

### Prerequisites
- Node.js 22.x
- Corepack enabled
- Docker Desktop (optional, for sqlite-web + mailhog tools)

### Start
```bash
corepack pnpm install
DATABASE_URL=file:./specmas.db corepack pnpm db:bootstrap
corepack pnpm dev:full
```

### URLs
- Web app: `http://localhost:3000`
- API: `http://localhost:3100`
- SQLite web (optional): `http://localhost:8080`
- Mailhog UI (optional): `http://localhost:8025` (SMTP on `localhost:1025`)

### Runtime API Surface
- Public probes:
  - `GET /health`
  - `GET /readyz`
- Protected read endpoints (require `x-role` header: `viewer|developer|operator|admin`):
  - `GET /runs`
  - `GET /runs/:runId`
  - `GET /runs/:runId/artifacts`
  - `GET /runs/:runId/logs`
- Session endpoints:
  - `POST /sessions`
  - `GET /sessions/:sessionId`
  - `POST /sessions/:sessionId/resume`

The web runtime consumes these through a typed client at `apps/web/src/runtime/apiClient.ts`, with default API base `http://localhost:3100`.

### Local Auth + Session UX
- Web runtime now requires login before route access.
- Local auth endpoint: `POST /auth/login` (public).
- Default local users (password matches username): `admin`, `operator`, `developer`, `viewer`.
- Protected API routes accept bearer tokens and still support `x-role` for non-UI test tooling.
- Web session lifecycle:
  - stores auth session in local storage,
  - enforces role-based UI behavior (for example, `viewer` is read-only for authoring sync/create),
  - restores persisted authoring session ids,
  - signs user out when token/session expires.

### Database Bootstrap
- `DATABASE_URL` must point to a writable SQLite DB path (default used by scripts: `file:./specmas.db`, resolved relative to `prisma/schema.prisma`).
- Bootstrap command:
```bash
DATABASE_URL=file:./specmas.db corepack pnpm db:bootstrap
```
- API startup preflight now verifies:
  - required Prisma schema/migration files exist,
  - SQLite file exists (for file-based URLs),
  - all local migrations are applied before API starts listening.

### Optional Team Tools
```bash
docker compose -f docs/release/docker-compose.team.yml up -d
```

## Authoring Rule (DRY)
- Keep canonical requirement text in `specs/spec-mas-v2-definition.md`.
- In split specs, reference `SRC-*` IDs and cross-link related spec files instead of duplicating requirement blocks.

## CLI Agent Generation
Use `specmas agent generate` to execute one of the supported agent providers.

### Command
```bash
specmas agent generate --agent <codex|claude|gemini> --prompt "<instruction>"
```

### Modes
- `--mode local_cli` (default): executes the local CLI adapter path for the selected provider.
- `--mode remote_api`: sends a `POST` request to a remote endpoint.
- `--remote-url <url>`: required when `--mode remote_api`.

### Examples
```bash
# Default local CLI execution
specmas agent generate --agent codex --prompt "Implement feature X"

# Explicit local CLI mode with JSON output
specmas agent generate --agent claude --prompt "Review this patch" --mode local_cli --format json

# Remote API mode
specmas agent generate --agent gemini --prompt "Generate tests" --mode remote_api --remote-url https://api.example.com/specmas/generate
```

## True E2E Validation (`RUN_TRUE_E2E=1`)
- The real-components E2E test is at `packages/test-utils/tests/real-components-full.e2e.test.ts`.
- It is skip-gated by default and only runs when `RUN_TRUE_E2E=1`.
- This keeps normal CI/local default suites stable when real toolchains are unavailable.
- Set `RUN_TRUE_E2E_LOCAL_ONLY=1` to run a local-only path with no provider API calls.

### Required Environment Variables
When `RUN_TRUE_E2E_LOCAL_ONLY` is not set:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

### Required Local Commands/Runtime
- `codex`
- `claude`
- `gemini`
- `docker`
- `npm`
- `node`
- Docker image `nginx:alpine` must already exist locally (the test fails fast instead of pulling).
- In `RUN_TRUE_E2E_LOCAL_ONLY=1` mode, provider API env vars are not required, but local CLIs are still required and must generate/modify code or the test fails.

### Run Command
```bash
RUN_TRUE_E2E=1 COREPACK_HOME=/tmp/corepack corepack pnpm --filter @specmas/test-utils test:e2e

# Local-only (no provider API calls)
RUN_TRUE_E2E=1 RUN_TRUE_E2E_LOCAL_ONLY=1 COREPACK_HOME=/tmp/corepack corepack pnpm --filter @specmas/test-utils exec vitest run tests/real-components-full.e2e.test.ts
```

### Expected Behavior
- The test executes a real end-to-end flow:
  - builds a spec from a fixed brief using the real toolchain command path,
  - validates spec-mas compliance with `parseSpecDocument`,
  - invokes `codex`, `claude`, and `gemini` toolchains,
  - executes OpenHands lifecycle via `LocalDockerOpenHandsRuntimeAdapter` + `runLifecycle`,
  - verifies workflow task trigger order/timestamps and sandbox teardown,
  - verifies gates `G1`..`G4` are all triggered and passed.
- If prerequisites are missing while `RUN_TRUE_E2E=1`, preflight fails fast with clear missing env/command/image errors.
