# TASKS.md

## Spec-MAS v2 Implementation Plan (Extremely Detailed)

Last updated: 2026-02-19  
Status: Planned (no implementation tasks started)

### Canonical Sources
- `spec-mas-v2-definition.md`
- `reference-map.md`
- Architecture specs: `architecture/A01-system-layers.md` through `architecture/A09-dashboard-architecture.md`
- Feature specs: `features/F01-openhands-orchestration-runtime.md` through `features/F12-github-actions-integration.md`
- Validation specs: `validation/V01-g1-g4-validation-gates.md` through `validation/V07-validation-tooling-and-artifacts.md`

### Planning Assumptions and Constraints
- v2 runtime is local-first OpenHands on Docker (`SRC-2.2`, `SRC-2.5`).
- GitHub Issues are the canonical execution queue (`SRC-8`).
- Validation gates (G1-G4) are mandatory before downstream phase execution (`SRC-6`; `validation/V01-g1-g4-validation-gates.md`).
- Artifacts are the source of execution evidence (`SRC-11`; `features/F11-artifact-management-and-viewers.md`).
- CI integration is GitHub Actions-first for v2 (`SRC-12`).
- No cloud-hosted OpenHands in v2 (`SRC-15`, future scope only).

### Team Model (for planning)
- TL: Tech Lead
- BE: Backend Engineer
- FE: Frontend Engineer
- INFRA: Platform/DevOps Engineer
- QA: Test/Validation Engineer
- SEC: Security Engineer

### Task ID Conventions
- `P0-*`: Pre-foundation setup
- `P1-*` to `P6-*`: Core implementation phases aligned to roadmap
- `VX-*`: Cross-phase validation/release stream
- `OPS-*`: Cutover and operations hardening

### Milestones and Exit Gates
- `M0` Planning complete: backlog structured, dependencies mapped, CI skeleton live.
- `M1` Foundation complete: API/CLI/dashboard skeletons + persistence + base observability.
- `M2` Runtime complete: OpenHands lifecycle + rollback/recovery functional.
- `M3` Execution ecosystem complete: agent routing + workflows/gates + GitHub issue orchestration + Actions hooks.
- `M4` Visibility complete: artifacts + dashboard flows production-ready.
- `M5` Authoring complete: conversational UI + templates + live validation integrated.
- `M6` Production readiness: multi-project, notifications/webhooks, security, deployment, migration.
- `M7` GA: release cut, post-release SLO monitoring and incident readiness validated.

---

## Phase 0 (Weeks 0-1): Pre-Foundation Setup

Goal: Convert specs into an executable delivery system with traceable ownership and dependency clarity.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | Define implementation scope baseline and non-goal guardrails | TL | None | `reference-map.md` `SRC-0` | Scope memo with explicit in/out list | Sign-off from TL+INFRA+QA; non-goal checks mapped to review checklist |
| P0-02 | Build requirement-to-task traceability matrix | TL, QA | P0-01 | `reference-map.md`, all `features/F*.md` | `traceability-matrix.md` draft | Every feature spec has at least one mapped implementation task and one validation task |
| P0-03 | Define repo/package layout for implementation code | TL, BE | P0-01 | `architecture/A01-system-layers.md`, `architecture/A02-api-services.md` | Proposed folder/package tree (API, CLI, UI, runtime, adapters, tests) | Layout supports separation of API/CLI/UI/runtime and test suites |
| P0-04 | Create ADR template + decision log process | TL | P0-01 | `architecture/A01-system-layers.md` | `docs/adr/000-template.md` plan entry | Architecture-impacting changes require ADR IDs |
| P0-05 | Define issue taxonomy, labels, and project board views | TL, QA | P0-02 | `features/F08-github-issues-work-queue.md`, `SRC-8` | Label dictionary and workflow board columns | Labels cover state, phase, gate status, priority, owner, risk |
| P0-06 | Configure baseline CI (lint, typecheck, unit placeholder jobs) | INFRA | P0-03 | `features/F12-github-actions-integration.md`, `SRC-12` | Initial CI workflow definitions | PR must run baseline checks and publish status checks |
| P0-07 | Define coding standards, branching, and commit conventions | TL | P0-03 | `features/F09-rollback-and-recovery.md`, `SRC-9` | Engineering standards doc | Branch-per-task and commit frequency policy documented |
| P0-08 | Create risk register and mitigation owners | TL, SEC | P0-01 | `architecture/A07-security-architecture.md`, `validation/V06-non-functional-validation.md` | Risk log seeded with top 15 risks | High/critical risks have owner, trigger, mitigation, fallback |
| P0-09 | Define observability baseline (logs, metrics, trace IDs) | INFRA, BE | P0-03 | `architecture/A09-dashboard-architecture.md`, `SRC-14` | Observability plan with event naming standards | Every major component has minimum telemetry requirements |
| P0-10 | Finalize milestone gate checklist for M0-M7 | TL, QA | P0-02, P0-08 | `validation/V01-g1-g4-validation-gates.md`, `validation/V07-validation-tooling-and-artifacts.md` | Milestone gate checklists | Checklist is measurable and ties to artifacts/check outputs |

---

## Phase 1 (Weeks 1-4): Foundation Platform

Goal: Stand up skeleton services and shared primitives for runtime, workflows, artifacts, UI/CLI control, and secure credential handling.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | Implement API service shell with health/readiness endpoints | BE | P0-03, P0-06 | `architecture/A02-api-services.md` | API bootstrap service | Health and readiness endpoints pass in local and CI |
| P1-02 | Implement unified configuration loader (global/project/env) | BE | P0-03 | `features/F06-workflow-and-gate-configuration.md`, `features/F07-multi-project-operations.md`, `SRC-7` | Config module with precedence logic | Config precedence test suite passes for all override layers |
| P1-03 | Implement project registry core service | BE | P1-02 | `features/F07-multi-project-operations.md` | Project create/list/update/remove service | Project metadata persistence + retrieval verified |
| P1-04 | Create initial persistence layer and schema bootstrap | BE | P1-01 | `architecture/A06-data-model.md`, `SRC-16` | DB schema v0 + migrations mechanism | Core entities exist and can be migrated forward/back in dev |
| P1-05 | Implement run/phase/task state model and repository APIs | BE | P1-04 | `architecture/A06-data-model.md`, `architecture/A04-workflow-engine-and-execution.md` | State repositories and domain models | Create/update/query run hierarchy works via API tests |
| P1-06 | Implement internal event bus abstraction | BE | P1-01, P1-05 | `architecture/A05-integration-architecture.md`, `features/F10-notifications-and-webhooks.md` | Event bus with typed event contracts | Publish/subscribe integration tests pass with ordering assertions |
| P1-07 | Build CLI bootstrap and command group skeleton | BE | P1-01 | `features/F05-specmas-cli.md`, `SRC-5` | CLI root + subcommand placeholders | Command help tree matches planned command families |
| P1-08 | Build dashboard shell with auth/session placeholders | FE | P1-01 | `architecture/A09-dashboard-architecture.md`, `SRC-14` | Initial dashboard app shell | Dashboard loads and can connect to API health endpoint |
| P1-09 | Implement spec parser + front-matter validator primitive | BE, QA | P1-07 | `validation/V01-g1-g4-validation-gates.md`, `SRC-6` | Spec parse/validate module | Invalid front-matter and section errors are deterministic |
| P1-10 | Implement artifact manager skeleton and file IO contracts | BE | P1-05 | `features/F11-artifact-management-and-viewers.md`, `SRC-11` | Artifact service interface + storage contract | Artifacts can be written, indexed, and retrieved in dev |
| P1-11 | Add structured logging and trace correlation IDs | INFRA, BE | P1-01, P1-06 | `architecture/A09-dashboard-architecture.md`, `validation/V07-validation-tooling-and-artifacts.md` | Logging middleware and standards | Every API request and run event has traceable correlation ID |
| P1-12 | Implement baseline RBAC model stubs (role model only) | BE, SEC | P1-03 | `architecture/A07-security-architecture.md`, `SRC-13` | Role definitions + middleware hooks | Role checks available to API routes with deny-by-default option |
| P1-13 | Establish unit test framework and coverage threshold gates | QA | P1-06, P1-09 | `validation/V03-unit-test-criteria.md` | Unit test harness config and thresholds | Coverage gate active in CI and failing below threshold |
| P1-14 | Add integration smoke tests for API/CLI/dashboard wiring | QA | P1-07, P1-08 | `validation/V04-integration-test-criteria.md` | Smoke suite for core surfaces | Smoke suite green on fresh checkout in CI |
| P1-15 | Establish credential/secret management baseline | TL, INFRA, SEC | P0-03, P0-08, P0-09 | `architecture/A07-security-architecture.md`, `reference-map.md` `SRC-13` | Secret handling design, secure injection interfaces, CI/runtime bootstrap guidance, audit hooks | Secrets for agents/GitHub/notifications/runtime are consumable through documented interfaces and access is auditable |

---

## Phase 2 (Weeks 5-8): OpenHands Runtime and Recovery

Goal: Deliver deterministic runtime execution in sandboxes with robust rollback and recovery behavior.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P2-01 | Implement OpenHands runtime adapter interface | BE, INFRA | P1-05, P1-15 | `architecture/A03-openhands-runtime-lifecycle.md`, `SRC-2.3` | Runtime adapter contracts | Adapter can launch and manage OpenHands sessions in local Docker |
| P2-02 | Implement sandbox provisioner (image, resources, toolchain) | INFRA | P2-01 | `SRC-2.4`, `SRC-2.5` | Sandbox provisioning service | Containers launch with policy-compliant limits and mounted workspace |
| P2-03 | Implement lifecycle orchestrator (provision->execute->capture->teardown) | BE | P2-01, P2-02 | `features/F01-openhands-orchestration-runtime.md` | Lifecycle controller | End-to-end lifecycle completes for sample phase execution |
| P2-04 | Implement command/log streaming pipeline from sandbox | BE | P2-03 | `architecture/A09-dashboard-architecture.md`, `SRC-14` | Stream service and log persistence | Live logs visible in CLI and available for UI polling/streaming |
| P2-05 | Implement phase artifact capture and indexing | BE | P2-03, P1-10 | `features/F11-artifact-management-and-viewers.md`, `SRC-11` | Artifact collector integrated with lifecycle | Every phase emits metadata + artifacts with stable paths |
| P2-06 | Implement branch-per-task Git workspace manager | BE | P2-03 | `features/F09-rollback-and-recovery.md`, `SRC-9` | Git branch manager module | Runs create and isolate branch context per task |
| P2-07 | Implement commit cadence and checkpoint policy engine | BE | P2-06 | `features/F09-rollback-and-recovery.md` | Commit policy module | Checkpoint commits happen at configured cadence |
| P2-08 | Implement failure detector and failure taxonomy | BE, QA | P2-03 | `features/F09-rollback-and-recovery.md`, `validation/V06-non-functional-validation.md` | Failure detection service | Failures categorized with deterministic error codes |
| P2-09 | Implement recovery orchestrator (retry/restart/fallback) | BE | P2-08, P2-07 | `architecture/A04-workflow-engine-and-execution.md`, `SRC-9` | Recovery state machine | Configured recovery strategies execute as expected in tests |
| P2-10 | Implement recovery visibility artifacts and summaries | BE, FE | P2-09, P2-05 | `features/F09-rollback-and-recovery.md`, `validation/V07-validation-tooling-and-artifacts.md` | Recovery logs and summary artifact schema | Recovery history is queryable and linked to run/task context |
| P2-11 | Implement sandbox security controls (network/fs restrictions) | SEC, INFRA | P2-02 | `architecture/A07-security-architecture.md`, `SRC-13` | Security policy enforcement in runtime | Unauthorized network/fs patterns are blocked and audited |
| P2-12 | Build runtime integration test suite (happy/failure/recovery) | QA | P2-03 through P2-10 | `validation/V04-integration-test-criteria.md`, `validation/V05-e2e-regression-criteria.md` | Runtime integration suite | Suite validates lifecycle and recovery deterministically |

---

## Phase 3 (Weeks 9-12): Agents, Workflows, GitHub Queue, Actions

Goal: Enable full automated execution loop from spec decomposition through multi-agent implementation and CI-triggered runs.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P3-01 | Finalize agent adapter contract and lifecycle hooks | TL, BE | P2-03, P1-15 | `features/F02-multi-agent-cli-routing.md`, `SRC-3.1` | Adapter contract v1 | Adapter interface supports implement/review/test roles and secure credential injection points |
| P3-02 | Implement Claude Code adapter | BE | P3-01 | `features/F02-multi-agent-cli-routing.md` | Claude adapter module | Adapter passes connectivity and execution contract tests |
| P3-03 | Implement Codex adapter | BE | P3-01 | `features/F02-multi-agent-cli-routing.md` | Codex adapter module | Adapter passes connectivity and execution contract tests |
| P3-04 | Implement Gemini CLI adapter | BE | P3-01 | `features/F02-multi-agent-cli-routing.md` | Gemini adapter module | Adapter passes connectivity and execution contract tests |
| P3-05 | Implement routing engine and fallback chain evaluator | BE | P3-02, P3-03, P3-04 | `features/F02-multi-agent-cli-routing.md`, `SRC-3.2` | Routing policy engine | Deterministic routing decision output with fallback reasoning |
| P3-06 | Implement workflow YAML parser and schema validator | BE | P1-02 | `features/F06-workflow-and-gate-configuration.md`, `SRC-6` | Workflow schema + parser | Invalid workflow definitions fail with actionable diagnostics |
| P3-07 | Implement workflow executor with phase parallelism controls | BE | P3-06, P2-03 | `architecture/A04-workflow-engine-and-execution.md` | Workflow runtime engine | Parallel and sequential phase execution matches config |
| P3-08 | Implement G1-G4 gate runner integration | BE, QA | P3-07, P1-09 | `validation/V01-g1-g4-validation-gates.md`, `SRC-6` | Gate runner module | Gates produce deterministic pass/fail + findings artifacts |
| P3-09 | Implement custom gate extension loading | BE | P3-08 | `features/F06-workflow-and-gate-configuration.md` | Gate extension mechanism | Custom checks can register and run with versioned contracts |
| P3-10 | Implement spec FR decomposition to GitHub issues | BE | P3-08, P1-15 | `features/F08-github-issues-work-queue.md`, `SRC-8` | Decomposition service | FRs map to issues with dependencies and acceptance criteria |
| P3-11 | Implement issue label/state transition automation | BE | P3-10 | `features/F08-github-issues-work-queue.md` | Issue state machine automation | Status transitions enforce legal state graph |
| P3-12 | Implement structured agent comment protocol | BE | P3-05, P3-11 | `features/F08-github-issues-work-queue.md` | STARTED/PASS/FAIL/HANDOFF comment emitters | Comments contain required context and artifact links |
| P3-13 | Implement GitHub Actions workflows (validate/review/plan/run) | INFRA, QA | P3-08, P3-10 | `features/F12-github-actions-integration.md`, `SRC-12` | Actions workflow files and docs | PR checks execute with deterministic outputs |
| P3-14 | Implement PR status reporter and findings summarizer | BE | P3-13 | `features/F12-github-actions-integration.md` | Check-run/comment publishing module | PR shows gate/adversarial/run summaries with links |
| P3-16 | Harden GitHub automation for rate limits | BE, INFRA | P3-10, P3-13 | `features/F12-github-actions-integration.md`, `features/F08-github-issues-work-queue.md`, `reference-map.md` `SRC-8`, `SRC-12` | Rate-limit aware GitHub client behavior, retry/backoff policies, circuit-breaker telemetry, throttling test report | Issue/workflow/actions automation remains functional under injected rate-limit scenarios with observable degradation behavior |
| P3-15 | Build end-to-end pipeline test: spec -> issues -> run -> artifacts | QA | P3-01 through P3-14, P3-16 | `validation/V05-e2e-regression-criteria.md` | E2E execution test suite | Full pipeline passes in CI for fixture projects |

---

## Phase 4 (Weeks 13-16): Artifact and Dashboard Surfaces

Goal: Deliver operational visibility and artifact-first debugging across CLI and web dashboard.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P4-01 | Finalize artifact directory schema and metadata contracts | TL, BE | P2-05, P3-15 | `features/F11-artifact-management-and-viewers.md`, `SRC-11` | Artifact schema v1 | Schema supports all phase outputs and is backward-compatible |
| P4-02 | Implement artifact retention policies and cleanup jobs | BE, INFRA | P4-01 | `features/F11-artifact-management-and-viewers.md` | Retention engine | Retention policies execute safely with dry-run preview mode |
| P4-03 | Implement CLI artifact command set (`list/show/download/diff/open/clean`) | BE | P4-01, P1-07 | `features/F05-specmas-cli.md`, `features/F11-artifact-management-and-viewers.md` | Artifact CLI commands | Commands return stable machine-readable and human-readable output |
| P4-04 | Implement dashboard run list and run detail views | FE | P1-08, P3-07 | `architecture/A09-dashboard-architecture.md`, `SRC-14` | Run monitoring UI pages | Operators can navigate run timeline, phase states, and statuses |
| P4-05 | Implement artifact explorer UI with hierarchical browser | FE | P4-01, P4-04 | `features/F11-artifact-management-and-viewers.md` | Artifact browser component | Artifact navigation supports filtering by phase/agent/type |
| P4-06 | Implement artifact renderers (Markdown, JSON, SARIF, diff, HTML) | FE | P4-05 | `features/F11-artifact-management-and-viewers.md`, `validation/V07-validation-tooling-and-artifacts.md` | Renderer set with fallback download | All supported artifact types preview correctly or degrade gracefully |
| P4-07 | Implement live log and timeline streaming UI | FE, BE | P2-04, P4-04 | `architecture/A09-dashboard-architecture.md` | Stream endpoints + timeline widgets | Log stream latency and ordering meet operational requirements |
| P4-08 | Implement multi-project dashboard widgets and drill-downs | FE | P4-04, P1-03 | `features/F07-multi-project-operations.md`, `SRC-7` | Portfolio dashboard widgets | Cross-project status visible without violating isolation boundaries |
| P4-09 | Implement artifact search, query filters, and saved views | FE, BE | P4-05 | `features/F11-artifact-management-and-viewers.md` | Search/filter API and UI | Query performance and result relevance validated on large fixture data |
| P4-10 | Run UX/accessibility/performance hardening pass on dashboard | FE, QA | P4-04 through P4-09 | `architecture/A09-dashboard-architecture.md`, `validation/V06-non-functional-validation.md` | A11y report and perf budgets | Dashboard meets accessibility baseline and performance budgets |

---

## Phase 5 (Weeks 17-20): Conversational Authoring and Templates

Goal: Provide high-quality conversational spec authoring with reusable templates and integrated validation feedback.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P5-01 | Implement conversational session service and persistence | BE, FE | P1-08, P1-04 | `features/F03-conversational-spec-authoring.md`, `SRC-4.1`, `SRC-4.2` | Session API + storage | Sessions can be resumed with full context and version history |
| P5-02 | Implement guided conversation flow engine by spec sections | BE, FE | P5-01 | `features/F03-conversational-spec-authoring.md`, `SRC-4.2` | Guided flow engine | Section progression enforces required fields and sequencing |
| P5-03 | Implement authoring mode switcher (guided/edit/freeform) | FE | P5-02 | `features/F03-conversational-spec-authoring.md`, `SRC-4.3` | Mode switching UI + state sync | Mode switches preserve context and produce consistent output |
| P5-04 | Implement template registry and manifest parser | BE | P1-02, P5-01 | `features/F04-template-library-management.md`, `SRC-4.4` | Template manifest schema + registry service | Invalid manifests fail with clear diagnostics |
| P5-05 | Implement template variable resolver and prompt engine | BE, FE | P5-04 | `features/F04-template-library-management.md` | Variable resolver + prompt UI | Variable defaults, constraints, and computed values resolve deterministically |
| P5-06 | Integrate template operations into CLI workflows | BE | P5-04, P1-07 | `features/F05-specmas-cli.md`, `features/F04-template-library-management.md` | CLI template subcommands | List/show/create/import/export commands function end-to-end |
| P5-07 | Implement custom template save/import/export lifecycle | BE | P5-04, P5-06 | `features/F04-template-library-management.md` | Template pack/unpack tooling | Round-trip export/import preserves schema and behavior |
| P5-08 | Integrate live G1-G4 validation hints into authoring loop | BE, FE, QA | P5-02, P3-08 | `validation/V01-g1-g4-validation-gates.md`, `features/F03-conversational-spec-authoring.md` | Live validation service + UI hinting | Users receive actionable, section-scoped validation feedback |
| P5-09 | Implement spec output pipeline (save, optional commit, issue hooks) | BE | P5-03, P3-10 | `features/F03-conversational-spec-authoring.md`, `features/F08-github-issues-work-queue.md` | Output orchestration flow | Generated specs can trigger downstream planning with trace links |
| P5-10 | Build conversational authoring E2E suite and UX quality pass | QA, FE | P5-01 through P5-09 | `validation/V05-e2e-regression-criteria.md`, `validation/V03-unit-test-criteria.md` | Authoring E2E tests + bug fixes | Guided/edit/freeform flows are stable across primary scenarios |

---

## Phase 6 (Weeks 21-24): Multi-Project, Notifications, Security, Production

Goal: Complete operational capabilities and release readiness for production use.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| P6-01 | Finalize project-level config schema (agents/workflows/gates/notifications) | BE | P3-06, P1-02 | `features/F07-multi-project-operations.md`, `SRC-7` | Project config schema v1 | Config schema validates all required project settings |
| P6-02 | Implement full inheritance resolver (global->project->workflow->CLI->issue label) | BE | P6-01 | `features/F06-workflow-and-gate-configuration.md`, `features/F07-multi-project-operations.md` | Inheritance engine | Effective config trace available for debugging and audit |
| P6-03 | Implement project isolation guardrails (runtime, filesystem, credentials) | BE, SEC, INFRA | P6-02, P2-11 | `architecture/A07-security-architecture.md`, `features/F07-multi-project-operations.md` | Isolation enforcement controls | Cross-project data/resource leakage tests pass |
| P6-04 | Implement event catalog and event contract validation for notifications | BE | P1-06, P3-07 | `features/F10-notifications-and-webhooks.md`, `SRC-10` | Event contract definitions | Event producer compliance tests pass for all event types |
| P6-05 | Implement notification matcher/filter engine (rules, quiet hours, rate limits) | BE | P6-04 | `features/F10-notifications-and-webhooks.md` | Rule evaluation engine | Rule matching deterministic under load and edge-case inputs |
| P6-06 | Implement notification channel adapters (Slack, email, webhook, GitHub) | BE, INFRA | P6-05 | `features/F10-notifications-and-webhooks.md` | Channel connector modules | Delivery tests pass with retries/backoff and dead-letter handling |
| P6-07 | Implement notification templates and payload linting | BE, QA | P6-06 | `features/F10-notifications-and-webhooks.md`, `validation/V07-validation-tooling-and-artifacts.md` | Template renderer + payload validation | Invalid payloads caught pre-delivery; templates versioned |
| P6-08 | Implement webhook receiver security (signing, idempotency, replay protection) | SEC, BE | P6-06 | `architecture/A07-security-architecture.md`, `validation/V06-non-functional-validation.md` | Webhook security middleware | Security tests prove replay and tampering resistance |
| P6-09 | Finalize local-mode deployment scripts and setup UX | INFRA | P2-02, P4-10 | `architecture/A08-deployment-architecture.md`, `SRC-15` | Setup scripts and docs | New machine bootstrap succeeds from clean environment |
| P6-10 | Implement team-server deployment profile (`docker-compose`) | INFRA | P6-09, P6-03 | `architecture/A08-deployment-architecture.md` | Compose profiles and environment templates | Team-server mode runs API/runtime/dashboard with persistence |
| P6-11 | Complete RBAC enforcement and audit logging implementation | BE, SEC | P1-12, P6-03 | `architecture/A07-security-architecture.md`, `SRC-13` | Full authz checks + audit trail records | Restricted operations blocked and audited with actor context |
| P6-12 | Implement migration path tools and documentation (v1->v2) | BE, QA | P6-01, P6-09 | `reference-map.md` `SRC-17`, `architecture/A06-data-model.md` | Migration helpers and runbook | Migration dry runs succeed with rollback options documented |
| P6-13 | Production readiness review (load, failover, recovery drills) | TL, INFRA, QA, SEC | P6-03 through P6-12 | `validation/V06-non-functional-validation.md`, `features/F09-rollback-and-recovery.md` | Readiness report and remediation list | No blocking risks remain open for GA decision |
| P6-14 | GA release cut and stabilization window execution | TL, INFRA, QA | P6-13, VX-12 | `reference-map.md` `SRC-19`, `SRC-15` | Release artifacts + post-release monitoring plan | GA success metrics and error budgets are within targets |

---

## Cross-Phase Validation and Release Stream (VX)

Goal: Ensure implementation remains verifiable, deterministic, secure, and releasable at every phase.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| VX-01 | Create full validation architecture and test pyramid plan | QA, TL | P0-02 | `validation/V03-unit-test-criteria.md`, `validation/V04-integration-test-criteria.md`, `validation/V05-e2e-regression-criteria.md` | Test strategy doc | Every component has mapped unit/integration/e2e strategy |
| VX-02 | Implement reusable test fixture framework for sample projects | QA | VX-01, P1-04 | `validation/V04-integration-test-criteria.md` | Fixture libraries and seed scripts | Fixtures deterministic across CI and local runs |
| VX-03 | Build gate assertion harness for G1-G4 outputs | QA | P3-08 | `validation/V01-g1-g4-validation-gates.md` | Gate assertion helpers | Gate findings and statuses are validated with golden tests |
| VX-04 | Build adversarial review test suite and severity thresholds | QA, SEC | P3-13 | `validation/V02-adversarial-review-pipeline.md` | Adversarial test corpus | Severity thresholds enforce fail/pass policy as configured |
| VX-05 | Build unit coverage gating and trend reporting | QA | P1-13 | `validation/V03-unit-test-criteria.md` | Coverage gate + trend dashboard | Coverage gate active and regression alerts configured |
| VX-06 | Build integration matrix suite across API/CLI/runtime/GitHub | QA | P3-15 | `validation/V04-integration-test-criteria.md` | Integration matrix tests | Matrix runs in CI with reproducible pass/fail behavior |
| VX-07 | Build deterministic E2E suite for critical workflows | QA | P4-07, P5-10 | `validation/V05-e2e-regression-criteria.md` | E2E scenarios and baseline snapshots | Critical path scenarios are repeatable and flake rate is controlled |
| VX-08 | Build non-functional suite (perf/load/reliability/security regression) | QA, SEC, INFRA | P6-03, P6-10 | `validation/V06-non-functional-validation.md` | NFR test suite + budgets | Performance/reliability/security thresholds met |
| VX-09 | Standardize validation artifact contracts and retention checks | QA, BE | P4-01, P4-02 | `validation/V07-validation-tooling-and-artifacts.md`, `SRC-11` | Artifact contract tests | All validation stages emit required artifacts and metadata |
| VX-10 | Enforce CI release gates and protected branch policy integration | INFRA, QA | VX-03 through VX-09, P3-16 | `features/F12-github-actions-integration.md`, `validation/V07-validation-tooling-and-artifacts.md` | CI gate enforcement rules | Release branches blocked when gates fail or artifacts missing |
| VX-11 | Run chaos and recovery game days for runtime and notification failures | INFRA, QA, SEC | P6-06, P6-13 | `features/F09-rollback-and-recovery.md`, `features/F10-notifications-and-webhooks.md` | Game day reports and fixes | Recovery objectives met under injected failure scenarios |
| VX-12 | Build post-release SLO dashboards and weekly audit procedures | INFRA, TL, QA | VX-10, P6-14 | `reference-map.md` `SRC-19`, `SRC-14` | SLO dashboards + audit runbook | 30-day post-GA monitoring process is operational |

---

## Cutover and Operations Hardening (OPS)

Goal: De-risk production operation after feature completeness.

| ID | Task | Owner | Depends On | Spec References | Deliverables | Exit Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| OPS-01 | Build on-call rotation and incident severity policy | TL, INFRA | P6-13 | `architecture/A08-deployment-architecture.md` | Incident response policy | On-call coverage and escalation paths documented |
| OPS-02 | Build runbook set (runtime outage, GitHub outage, webhook outage) | INFRA, BE | OPS-01 | `architecture/A05-integration-architecture.md`, `features/F09-rollback-and-recovery.md` | Operational runbooks | Simulated incidents can be handled using runbooks only |
| OPS-03 | Build backup/restore process for metadata and artifacts | INFRA | P4-02, P6-10 | `architecture/A06-data-model.md`, `features/F11-artifact-management-and-viewers.md` | Backup automation scripts | Restore drills succeed with acceptable RTO/RPO |
| OPS-04 | Finalize secrets rotation and credential hygiene SOPs | SEC, INFRA | P6-11 | `architecture/A07-security-architecture.md` | Security operating procedures | Rotation cadence and emergency revocation tested |
| OPS-05 | Execute release candidate soak period and defect burn-down | TL, QA | P6-14, VX-08 | `validation/V05-e2e-regression-criteria.md`, `validation/V06-non-functional-validation.md` | Soak test report | No critical defects remain open post-soak |
| OPS-06 | GA handoff package (docs, dashboards, SOPs, training) | TL | OPS-01 through OPS-05 | `README.md`, `specs/README.md` | GA handoff bundle | Operations and engineering teams confirm readiness |

---

## Sprint-by-Sprint Plan (2-week sprints)

| Sprint | Focus | Primary Task IDs | Gate to Exit Sprint |
| --- | --- | --- | --- |
| S1 | Planning and setup | P0-01 to P0-10 | M0 checklist complete |
| S2 | Core API/config/persistence | P1-01 to P1-06 | Core services smoke-tested |
| S3 | CLI/dashboard/spec validation foundation + secrets baseline | P1-07 to P1-15 | M1 checklist complete |
| S4 | Runtime provisioning/lifecycle | P2-01 to P2-05 | Runtime happy-path green |
| S5 | Recovery and sandbox security | P2-06 to P2-12 | M2 checklist complete |
| S6 | Agent adapters and routing | P3-01 to P3-05 | Multi-agent routing tests green |
| S7 | Workflows/gates/issues automation | P3-06 to P3-12 | Gate and issue orchestration green |
| S8 | GitHub Actions + e2e pipeline + rate-limit hardening | P3-13 to P3-16 | M3 checklist complete |
| S9 | Artifact/CLI/dashboard visibility | P4-01 to P4-06 | Artifact flows complete |
| S10 | Streaming/multi-project UX hardening | P4-07 to P4-10 | M4 checklist complete |
| S11 | Conversational authoring + templates | P5-01 to P5-07 | Authoring core complete |
| S12 | Live validation + output pipeline | P5-08 to P5-10 | M5 checklist complete |
| S13 | Multi-project config + notifications core | P6-01 to P6-07 | Notification/event flow complete |
| S14 | Deployment/security/migration readiness | P6-08 to P6-13 | M6 checklist complete |
| S15 | GA cutover + post-release controls | P6-14, VX-12, OPS-* | M7 checklist complete |

---

## Critical Path

1. `P1-02` -> `P1-15` -> `P3-06` -> `P3-07` -> `P3-08` -> `P3-16` -> `P3-15` -> `VX-10` -> `P6-14`
2. `P2-01` -> `P2-03` -> `P2-09` -> `P3-15` -> `VX-07` -> `P6-13`
3. `P4-01` -> `P4-03`/`P4-05` -> `VX-09` -> `VX-10` -> `OPS-06`
4. `P5-01` -> `P5-08` -> `P5-10` -> `VX-07` -> `M5`

Any delay on these chains threatens GA dates; protect with dedicated owners and weekly risk review.

---

## Definition of Done (Global)

A task is complete only when all conditions are true:
- Implementation merged with tests.
- Required artifacts generated and accessible (logs, reports, run metadata as applicable).
- Documentation updated in relevant spec or runbook path.
- Validation checks pass in CI for affected scope.
- Traceability matrix updated with task-to-requirement linkage.

---

## Open Planning Risks To Track Weekly

- Adapter instability or upstream CLI behavior drift across providers.
- Runtime nondeterminism from environment/toolchain mismatch.
- Gate false positives/negatives reducing developer trust.
- GitHub API rate limits impacting issue-based orchestration (mitigated by `P3-16`, monitor until `VX-10` passes).
- Artifact growth and retention cost/performance pressure.
- Notification storming or delivery failures during incidents.
- Security drift between local and team-server deployment modes.
