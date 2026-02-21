# TASKS.md

## Spec-MAS v2 Atomic Backlog (AI-Implementable)

Last updated: 2026-02-21  
Status: Extended (`T001`-`T066`, `V001`-`V004` complete; `T067`-`T072` planned)

This file replaces macro roadmap tasks with small, deterministic units suitable for AI coding tools.

## Execution Contract (Applies to Every Task)

- One task = one PR.
- Scope limit: max 8 files changed and max ~350 net LOC. If larger, split before coding.
- Every task must produce/update tests for changed behavior.
- Every task must write a short run note to `artifacts/tasks/<TASK_ID>/report.md`.
- Task completion requires all listed verification commands to pass from repo root.

## Fixed Technical Baseline (Do Not Vary Unless a Task Changes It)

- Runtime: Node.js 22.x
- Package manager: `pnpm` (workspace)
- Language: TypeScript (`strict: true`)
- API framework: Fastify
- CLI framework: Commander
- Web app: React + Vite + TypeScript
- Unit tests: Vitest
- Integration/E2E harness: Vitest + Playwright
- DB: SQLite for local/dev via Prisma

## Canonical Repository Layout Target

- `apps/api`
- `apps/cli`
- `apps/web`
- `packages/config`
- `packages/core`
- `packages/runtime`
- `packages/adapters`
- `packages/workflow`
- `packages/github`
- `packages/artifacts`
- `packages/notifications`
- `packages/templates`
- `packages/test-utils`

## Standard Root Commands (Must Exist by T006)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm build`

---

## M0: Planning and Repo Foundation

- [x] `T001` Create scope baseline and non-goal guardrails  
  Depends: none  
  Implement: add `docs/planning/scope-baseline.md` with explicit in-scope, out-of-scope, and non-goal checks.  
  Verify: `test -f docs/planning/scope-baseline.md`

- [x] `T002` Build requirement-to-task traceability matrix  
  Depends: `T001`  
  Implement: add `docs/planning/traceability-matrix.md` mapping each `features/F*.md` to task IDs and validation IDs.  
  Verify: `test -f docs/planning/traceability-matrix.md && rg "F01|F12" docs/planning/traceability-matrix.md`

- [x] `T003` Scaffold monorepo layout  
  Depends: `T001`  
  Implement: create directory tree under `apps/*` and `packages/*` per Canonical Layout.  
  Verify: `test -d apps/api && test -d apps/cli && test -d apps/web && test -d packages/runtime`

- [x] `T004` Add ADR template and decision log index  
  Depends: `T001`  
  Implement: add `docs/adr/000-template.md` and `docs/adr/README.md`.  
  Verify: `test -f docs/adr/000-template.md && test -f docs/adr/README.md`

- [x] `T005` Define issue taxonomy and board columns  
  Depends: `T002`  
  Implement: add `docs/planning/issue-taxonomy.md` with labels for phase/state/gate/priority/owner/risk.  
  Verify: `test -f docs/planning/issue-taxonomy.md && rg "phase|gate|priority" docs/planning/issue-taxonomy.md`

- [x] `T006` Initialize workspace tooling and root scripts  
  Depends: `T003`  
  Implement: add `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.npmrc`, root scripts listed above.  
  Verify: `pnpm install && pnpm lint && pnpm typecheck`

---

## M1: Foundation Platform

- [x] `T007` Configure TypeScript base config  
  Depends: `T006`  
  Implement: add root `tsconfig.base.json` and per-package tsconfig extends.  
  Verify: `pnpm typecheck`

- [x] `T008` Configure lint/format baseline  
  Depends: `T006`  
  Implement: add ESLint + Prettier configs and apply to all workspaces.  
  Verify: `pnpm lint`

- [x] `T009` Create unit test harness baseline  
  Depends: `T006`  
  Implement: add Vitest config(s), coverage output folders, and one passing smoke test in `packages/core`.  
  Verify: `pnpm test:unit`

- [x] `T010` Implement API shell with health and readiness  
  Depends: `T003`, `T007`  
  Implement: in `apps/api`, add Fastify bootstrap + `/health` and `/readyz`.  
  Verify: `pnpm --filter @specmas/api test:unit`

- [x] `T011` Implement unified config schema module  
  Depends: `T003`, `T007`  
  Implement: in `packages/config`, define Zod schema for global/project/env/CLI overrides.  
  Verify: `pnpm --filter @specmas/config test:unit`

- [x] `T012` Implement config precedence resolver  
  Depends: `T011`  
  Implement: add deterministic merge order `global -> project -> env -> cli -> issue-label` and tests.  
  Verify: `pnpm --filter @specmas/config test:unit`

---

## M2: Core State and Service Primitives

- [x] `T013` Bootstrap Prisma schema and migration system  
  Depends: `T006`  
  Implement: create `prisma/schema.prisma`, migration config, and initial migration command script.  
  Verify: `pnpm prisma:migrate:dev`

- [x] `T014` Add Project/Run/Phase/Task/Artifact tables  
  Depends: `T013`  
  Implement: model entities and relations required by `architecture/A06-data-model.md`.  
  Verify: `pnpm prisma:generate && pnpm --filter @specmas/core test:unit`

- [x] `T015` Implement project registry repository  
  Depends: `T014`, `T011`  
  Implement: add CRUD repository in `packages/core` for projects with unit tests.  
  Verify: `pnpm --filter @specmas/core test:unit -- project-registry`

- [x] `T016` Implement run/phase/task state repositories  
  Depends: `T014`  
  Implement: add repositories and typed status enums for run hierarchy.  
  Verify: `pnpm --filter @specmas/core test:unit -- run-state`

- [x] `T017` Implement legal state transition validator  
  Depends: `T016`  
  Implement: add pure transition guards (reject illegal transitions deterministically).  
  Verify: `pnpm --filter @specmas/core test:unit -- state-transition`

- [x] `T018` Implement internal event bus abstraction  
  Depends: `T016`  
  Implement: add typed publish/subscribe interface with in-memory adapter and ordering tests.  
  Verify: `pnpm --filter @specmas/core test:unit -- event-bus`

---

## M3: CLI and Dashboard Skeleton

- [x] `T019` Bootstrap CLI root and command tree  
  Depends: `T003`, `T007`  
  Implement: in `apps/cli`, add `specmas` root with command groups: `project`, `run`, `agent`, `artifact`, `issues`.  
  Verify: `pnpm --filter @specmas/cli test:unit`

- [x] `T020` Implement `project` CLI commands (list/show/create/remove)  
  Depends: `T015`, `T019`  
  Implement: wire `project` commands to project registry service with JSON and table output modes.  
  Verify: `pnpm --filter @specmas/cli test:unit -- project-command`

- [x] `T021` Implement `run` CLI command skeleton (`start/status/cancel`)  
  Depends: `T016`, `T019`  
  Implement: command handlers with stubs to runtime service + validation of required args.  
  Verify: `pnpm --filter @specmas/cli test:unit -- run-command`

- [x] `T022` Bootstrap dashboard web shell  
  Depends: `T003`, `T007`  
  Implement: in `apps/web`, add React shell app with route skeleton and API health ping on load.  
  Verify: `pnpm --filter @specmas/web test:unit`

- [x] `T023` Implement spec parser and front-matter validator  
  Depends: `T007`  
  Implement: in `packages/core`, parse markdown + YAML front matter and enforce required fields.  
  Verify: `pnpm --filter @specmas/core test:unit -- spec-parser`

- [x] `T024` Implement artifact manager skeleton  
  Depends: `T014`  
  Implement: in `packages/artifacts`, add write/index/read interfaces and local filesystem adapter.  
  Verify: `pnpm --filter @specmas/artifacts test:unit`

---

## M4: Quality, Security Baseline, and Integration Smoke

- [x] `T025` Add structured request logging with correlation IDs  
  Depends: `T010`, `T018`  
  Implement: API middleware emits structured logs and correlation IDs per request/run event.  
  Verify: `pnpm --filter @specmas/api test:unit -- logging`

- [x] `T026` Add baseline RBAC role model and deny-by-default middleware  
  Depends: `T010`  
  Implement: role definitions and route guard hooks with unit tests for allow/deny behavior.  
  Verify: `pnpm --filter @specmas/api test:unit -- rbac`

- [x] `T027` Add unit coverage thresholds to CI  
  Depends: `T009`  
  Implement: enforce minimum coverage thresholds and fail builds under threshold.  
  Verify: `pnpm test:unit`

- [x] `T028` Add baseline CI workflows  
  Depends: `T006`, `T027`  
  Implement: create `.github/workflows/ci.yml` for lint/typecheck/unit on PR + push.  
  Verify: `test -f .github/workflows/ci.yml`

- [x] `T029` Add integration smoke suite for API/CLI/web wiring  
  Depends: `T020`, `T021`, `T022`  
  Implement: add smoke tests under `packages/test-utils` and integration command.  
  Verify: `pnpm test:integration`

- [x] `T030` Define credential and secret injection interfaces  
  Depends: `T011`, `T026`  
  Implement: add `packages/config` secret reference contracts + docs under `docs/security/secrets.md`.  
  Verify: `pnpm --filter @specmas/config test:unit -- secrets && test -f docs/security/secrets.md`

---

## M5: Runtime and Recovery

- [x] `T031` Define OpenHands runtime adapter contract  
  Depends: `T016`, `T030`  
  Implement: add `packages/runtime` interfaces for provision, execute, stream, teardown.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- adapter-contract`

- [x] `T032` Implement sandbox provisioner (Docker)  
  Depends: `T031`  
  Implement: add provisioner with image/workspace/resource config and deterministic config validation.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- provisioner`

- [x] `T033` Implement lifecycle orchestrator  
  Depends: `T031`, `T032`  
  Implement: orchestrate `provision -> execute -> capture -> teardown` with error-safe cleanup.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- lifecycle`

- [x] `T034` Implement command/log streaming pipeline  
  Depends: `T033`  
  Implement: stream runtime output to API and persist raw logs by run/task identifiers.  
  Verify: `pnpm --filter @specmas/runtime test:integration -- streaming`

- [x] `T035` Implement Git branch-per-task workspace manager  
  Depends: `T033`  
  Implement: create/checkout task branches and isolate branch context per task.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- git-workspace`

- [x] `T036` Implement failure taxonomy and recovery state machine  
  Depends: `T033`, `T035`  
  Implement: classify failures + run deterministic retry/restart/fallback transitions.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- recovery`

---

## M6: Multi-Agent Routing and Workflow Engine

- [x] `T037` Finalize agent adapter contract v1  
  Depends: `T031`  
  Implement: define role-aware adapter interface for `implement`, `test`, `review` and credential injection hooks.  
  Verify: `pnpm --filter @specmas/adapters test:unit -- contract`

- [x] `T038` Implement Claude adapter  
  Depends: `T037`  
  Implement: adapter module with command composition, env injection, and connectivity checks.  
  Verify: `pnpm --filter @specmas/adapters test:unit -- claude`

- [x] `T039` Implement Codex adapter  
  Depends: `T037`  
  Implement: adapter module with command composition, env injection, and connectivity checks.  
  Verify: `pnpm --filter @specmas/adapters test:unit -- codex`

- [x] `T040` Implement Gemini adapter  
  Depends: `T037`  
  Implement: adapter module with command composition, env injection, and connectivity checks.  
  Verify: `pnpm --filter @specmas/adapters test:unit -- gemini`

- [x] `T041` Implement routing engine and fallback evaluator  
  Depends: `T038`, `T039`, `T040`, `T012`  
  Implement: deterministic selection order with explanation output and fallback chain handling.  
  Verify: `pnpm --filter @specmas/workflow test:unit -- routing`

- [x] `T042` Implement workflow YAML schema parser  
  Depends: `T012`  
  Implement: parse/validate workflow definitions with actionable diagnostics for invalid config.  
  Verify: `pnpm --filter @specmas/workflow test:unit -- workflow-schema`

---

## M7: Gates, GitHub Queue, and Actions

- [x] `T043` Implement workflow executor with phase parallelism controls  
  Depends: `T033`, `T042`  
  Implement: execute phases sequentially or in parallel per workflow config.  
  Verify: `pnpm --filter @specmas/workflow test:integration -- executor`

- [x] `T044` Implement G1-G4 gate runner  
  Depends: `T023`, `T043`  
  Implement: evaluate required gates and emit deterministic pass/fail findings artifacts.  
  Verify: `pnpm --filter @specmas/workflow test:unit -- gate-runner`

- [x] `T045` Implement custom gate extension loader  
  Depends: `T044`  
  Implement: dynamic gate registration with explicit contract version validation.  
  Verify: `pnpm --filter @specmas/workflow test:unit -- gate-extensions`

- [x] `T046` Implement spec FR decomposition to GitHub issues  
  Depends: `T023`, `T044`  
  Implement: map functional requirements into issue payloads including dependencies and acceptance criteria.  
  Verify: `pnpm --filter @specmas/github test:unit -- decomposition`

- [x] `T047` Implement issue state transition automation and structured comments  
  Depends: `T046`  
  Implement: legal state graph transitions + STARTED/PASS/FAIL/HANDOFF comment emitters.  
  Verify: `pnpm --filter @specmas/github test:unit -- issue-state`

- [x] `T048` Implement GitHub Actions pipelines and PR summary reporter  
  Depends: `T044`, `T046`, `T047`  
  Implement: add workflows for `validate`, `review`, `plan`, `run` + check-run/comment summary publisher.  
  Verify: `test -f .github/workflows/validate.yml && test -f .github/workflows/run.yml`

---

## M8: Artifacts and Operational Visibility

- [x] `T049` Finalize artifact metadata schema  
  Depends: `T024`, `T044`  
  Implement: define artifact manifest schema for phase/task/run metadata and links.  
  Verify: `pnpm --filter @specmas/artifacts test:unit -- schema`

- [x] `T050` Implement artifact retention policy engine  
  Depends: `T049`  
  Implement: retention/cleanup with dry-run mode and safety checks.  
  Verify: `pnpm --filter @specmas/artifacts test:unit -- retention`

- [x] `T051` Implement CLI artifact commands  
  Depends: `T019`, `T049`  
  Implement: add `artifact list/show/download/diff/open/clean` in `apps/cli`.  
  Verify: `pnpm --filter @specmas/cli test:unit -- artifact-command`

- [x] `T052` Implement dashboard run list and run detail views  
  Depends: `T022`, `T043`  
  Implement: web routes/components for run timeline, phase states, and status badges.  
  Verify: `pnpm --filter @specmas/web test:unit -- run-views`

- [x] `T053` Implement artifact explorer and renderers  
  Depends: `T052`, `T049`  
  Implement: hierarchical artifact browser and renderers for Markdown/JSON/SARIF/diff/HTML.  
  Verify: `pnpm --filter @specmas/web test:unit -- artifact-explorer`

- [x] `T054` Implement live log/timeline streaming UI  
  Depends: `T034`, `T052`  
  Implement: real-time log stream widgets with ordering and reconnect handling.  
  Verify: `pnpm --filter @specmas/web test:integration -- log-stream`

---

## M9: Authoring, Templates, Multi-Project, and Release Readiness

- [x] `T055` Implement conversational session service  
  Depends: `T014`, `T022`  
  Implement: session persistence API with create/load/resume semantics.  
  Verify: `pnpm --filter @specmas/api test:unit -- conversation-session`

- [x] `T056` Implement guided authoring flow and mode switcher  
  Depends: `T055`  
  Implement: guided/edit/freeform modes with deterministic section progression rules.  
  Verify: `pnpm --filter @specmas/web test:unit -- authoring-flow`

- [x] `T057` Implement template registry and variable resolver  
  Depends: `T056`  
  Implement: template manifest parser + variable defaults/constraints/computed values resolver.  
  Verify: `pnpm --filter @specmas/templates test:unit`

- [x] `T058` Implement project-level inheritance resolver and isolation checks  
  Depends: `T012`, `T036`  
  Implement: effective config trace (`global -> project -> workflow -> cli -> label`) and cross-project isolation guards.  
  Verify: `pnpm --filter @specmas/config test:unit -- inheritance && pnpm --filter @specmas/runtime test:unit -- isolation`

- [x] `T059` Implement notifications engine and channel adapters  
  Depends: `T018`, `T058`  
  Implement: event catalog, matcher/filter rules, and channel adapters (Slack/email/webhook/GitHub).  
  Verify: `pnpm --filter @specmas/notifications test:unit`

- [x] `T060` Implement deployment, migration, and GA validation bundle  
  Depends: `T048`, `T054`, `T059`  
  Implement: local setup scripts, `docker-compose` team profile, migration dry-run tooling, readiness checklist docs.  
  Verify: `pnpm test:integration && pnpm test:e2e && test -f docs/release/ga-readiness-checklist.md`

---

## M10: Local npm Runtime Model Realignment

- [x] `T061` Realign deployment docs and compose scope to local npm app services + Dockerized third-party services  
  Depends: `T060`  
  Implement: update `specs/*`, `README.md`, `docs/release/*`, and `docs/release/docker-compose.team.yml` so Spec-MAS app services run as local npm processes and Docker is restricted to third-party/runtime dependencies (OpenHands, DB, mail, etc).  
  Verify: `docker compose -f docs/release/docker-compose.team.yml config && rg "local npm processes|third-party services" specs docs README.md`

- [x] `T062` Add deployment-mode schema and validation guardrails  
  Depends: `T061`  
  Implement: add explicit deployment mode contract in config (`local_process` for app services, `containerized_dependency` for third-party services) and reject invalid v2 combinations.  
  Verify: `pnpm --filter @specmas/config test:unit -- schema precedence`

- [x] `T063` Add runtime startup guard for Docker dependency scope  
  Depends: `T062`  
  Implement: ensure runtime bootstrap only requires Docker for OpenHands/dependency paths and emits deterministic errors for invalid mode mixes.  
  Verify: `pnpm --filter @specmas/runtime test:unit`

- [x] `T064` Add integration tests for local app process + Dockerized dependencies profile  
  Depends: `T063`  
  Implement: integration tests validating app-process startup assumptions and dependency-container health checks.  
  Verify: `pnpm --filter @specmas/test-utils test:integration`

- [x] `T065` Add E2E assertions for enforced local-cli generation behavior  
  Depends: `T064`  
  Implement: keep true E2E local-only mode requiring real `codex`/`claude`/`gemini` invocations and fail on no-op generation.  
  Verify: `RUN_TRUE_E2E=1 RUN_TRUE_E2E_LOCAL_ONLY=1 pnpm --filter @specmas/test-utils exec vitest run tests/real-components-full.e2e.test.ts`

- [x] `T066` Final parity sweep across release runbooks and QA artifacts  
  Depends: `T061`, `T064`, `T065`  
  Implement: reconcile docs/QA artifacts with runtime behavior and update `artifacts/qa/docs-parity-report.md` + `artifacts/qa/integration-report.md`.  
  Verify: `test -f artifacts/qa/docs-parity-report.md && test -f artifacts/qa/integration-report.md`

---

## M11: OpenHands-to-UI Runtime Integration Closure

- [ ] `T067` Replace API fixture run read-models with persistent run/query services  
  Depends: `T014`, `T055`  
  Implement: remove hardcoded run fixtures from API runtime paths and back `/runs`, `/runs/:runId`, `/runs/:runId/artifacts`, `/runs/:runId/logs`, and `/runs/:runId/logs/stream` with persisted data sources.  
  Verify: `pnpm --filter @specmas/api test:unit -- runs-read && pnpm --filter @specmas/api test:integration`

- [ ] `T068` Add real run execution control path from API to workflow/runtime orchestration  
  Depends: `T067`, `T033`, `T043`  
  Implement: add run start/cancel control flow, execute phases through workflow executor + runtime adapter, and persist run/phase/task status transitions for UI consumption.  
  Verify: `pnpm --filter @specmas/api test:unit -- run-control && pnpm --filter @specmas/test-utils test:integration -- fixture-project`

- [ ] `T069` Persist OpenHands execution logs and artifacts for live API/UI retrieval  
  Depends: `T068`, `T034`, `T049`  
  Implement: wire runtime log pipeline and artifact manager into the application run path so API log/artifact endpoints return real execution outputs with cursor-safe streaming semantics.  
  Verify: `pnpm --filter @specmas/runtime test:integration -- streaming && pnpm --filter @specmas/api test:integration -- runs`

- [ ] `T070` Add startup/runtime readiness guardrails for OpenHands-backed execution  
  Depends: `T063`, `T068`  
  Implement: add deterministic startup checks and local runtime profile wiring so manual stack startup clearly reports OpenHands/dependency readiness and invalid mode mixes.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- bootstrap && pnpm --filter @specmas/test-utils test:integration -- deployment-profile`

- [ ] `T071` Add real-runtime Playwright coverage for core dashboard workflows  
  Depends: `T067`, `T068`, `T069`, `T070`  
  Implement: add Playwright scenarios that start real runs and assert dynamic run ids, status progression, runtime logs, and artifact visibility without relying on fixture run IDs/content.  
  Verify: `pnpm --filter @specmas/web test:e2e -- --grep real-runtime`

- [ ] `T072` Update canonical and split specs for the finalized OpenHands/UI integration contract  
  Depends: `T067`, `T068`, `T069`, `T070`, `T071`  
  Implement: update `specs/spec-mas-v2-definition.md`, `specs/reference-map.md`, and relevant split specs to reflect implemented run control paths, persistence/streaming behavior, runtime startup model, and real-runtime UI validation criteria.  
  Verify: `rg "run control|persistent run data|OpenHands runtime readiness|real-runtime e2e|dashboard run state" specs/spec-mas-v2-definition.md specs/reference-map.md specs/features/F01-openhands-orchestration-runtime.md specs/architecture/A03-openhands-runtime-lifecycle.md specs/architecture/A08-deployment-architecture.md specs/architecture/A09-dashboard-architecture.md specs/validation/V05-e2e-regression-criteria.md specs/validation/V07-validation-tooling-and-artifacts.md`

---

## M12: Project/Repo and Branch-Aware Dashboard + Human-Approval Merge Flow

- [x] `T073` Add project/repo query APIs for dashboard selection  
  Depends: `T067`  
  Implement: add API endpoints for project list and project detail including `project_id`, `name`, `repo_url`, `default_branch`, and active run counts; enforce auth/role checks and deterministic response schema.  
  Verify: `pnpm --filter @specmas/api test:unit -- projects && pnpm --filter @specmas/api test:integration -- projects`

- [x] `T074` Add branch inventory APIs per project and run  
  Depends: `T073`, `T068`  
  Implement: add API endpoints to return project branch inventory (`default`, `integration`, `release`, `active run branches`) and include branch lineage fields on run detail/read models.  
  Verify: `pnpm --filter @specmas/api test:unit -- branches && pnpm --filter @specmas/api test:integration -- runs-read`

- [x] `T075` Implement dashboard project/repo selector and project-scoped routing  
  Depends: `T073`, `T055`  
  Implement: add project selector UI, persist selected project, and scope all run/issues/artifact requests to selected `project_id`; show project name/repo/default branch header in project view.  
  Verify: `pnpm --filter @specmas/web test:unit -- project-selector && pnpm --filter @specmas/web test:e2e -- --grep project-selector`

- [x] `T076` Implement branch selector and branch-filtered run views  
  Depends: `T074`, `T075`  
  Implement: add branch selector to project view, filter run lists/details by selected branch context, and display `source/working/integration/release` branch lineage per run.  
  Verify: `pnpm --filter @specmas/web test:unit -- branch-selector run-views && pnpm --filter @specmas/web test:e2e -- --grep branch-filter`

- [x] `T077` Enforce dedicated run/task branch allocation in runtime orchestration  
  Depends: `T035`, `T068`  
  Implement: enforce deterministic branch naming and uniqueness per run/task, reject branch reuse across runs, and persist branch allocation metadata for API/UI consumption.  
  Verify: `pnpm --filter @specmas/runtime test:unit -- git-workspace lifecycle && pnpm --filter @specmas/runtime test:integration -- lifecycle`

- [x] `T078` Add human-approval merge gate and merge-state transitions  
  Depends: `T077`, `T044`  
  Implement: add merge state machine (`awaiting_human_approval`, `approved`, `rejected`, `merged`), require explicit human approval event before merge actions, and block auto-merge on agent completion.  
  Verify: `pnpm --filter @specmas/workflow test:unit -- gate-runner executor && pnpm --filter @specmas/api test:integration -- merge-approval`

- [x] `T079` Add integration coverage for project/branch dashboard contract and approval flow  
  Depends: `T074`, `T076`, `T078`  
  Implement: add integration tests spanning API + runtime + workflow proving project scoping, branch lineage persistence, approval-required merge progression, and rejection handling.  
  Verify: `pnpm --filter @specmas/test-utils test:integration -- integration-matrix spec-to-build`

- [x] `T080` Add true E2E scenario for project selection -> branch execution -> human-approved merge  
  Depends: `T079`, `T071`  
  Implement: create one end-to-end Playwright + real-runtime scenario that selects a project/repo, runs workflow on dedicated branches, verifies merge blocked pre-approval, applies human approval, then verifies merge completion and run finalization.  
  Verify: `RUN_TRUE_E2E=1 RUN_TRUE_E2E_LOCAL_ONLY=1 pnpm --filter @specmas/test-utils exec vitest run tests/real-components-full.e2e.test.ts --testNamePattern \"project selection.*human-approved merge\"`

---

## Cross-Cutting Validation Tasks (Run Continuously)

- [x] `V001` Add adversarial review suite and fail thresholds  
  Depends: `T048`  
  Implement: create tests per `validation/V02-adversarial-review-pipeline.md` with severity threshold enforcement.  
  Verify: `pnpm test:integration -- adversarial`

- [x] `V002` Add integration matrix suite across API/CLI/runtime/GitHub  
  Depends: `T048`, `T054`  
  Implement: matrix scenarios and fixture projects in `packages/test-utils`.  
  Verify: `pnpm test:integration`

- [x] `V003` Add deterministic critical-path E2E suite  
  Depends: `T060`  
  Implement: fixture for `spec -> issues -> run -> artifacts` with stable snapshots and flake controls.  
  Verify: `pnpm test:e2e`

- [x] `V004` Add non-functional regression suite (perf/reliability/security)  
  Depends: `T060`  
  Implement: budget assertions and regression checks aligned to `validation/V06-non-functional-validation.md`.  
  Verify: `pnpm test:integration -- non-functional`

---

## Task Completion Checklist (Per Task)

A task is done only if all are true:

- Target files were created/updated exactly as task requires.
- Unit tests include happy path, failure path, and edge cases.
- `artifacts/tasks/<TASK_ID>/report.md` exists with commands + outputs.
- Required verification commands pass locally.
- `docs/planning/traceability-matrix.md` is updated with task status.
