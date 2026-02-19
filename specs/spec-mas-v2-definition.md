---
specmas: v4
kind: SystemSpec
id: sys-specmas-v2
name: Spec-MAS v2 — OpenHands-Orchestrated Multi-Project Development Platform
version: 0.2.0
owners:
  - name: Chris Robertson
complexity: HIGH
maturity: 2
tags: [platform, orchestration, openhands, multi-project, agents, templates, notifications, webhooks, configs, github-actions]
---

# Spec-MAS v2 — End-to-End Definition

**Status:** Draft 2 · Date: 2026-02-18

Spec-MAS v2 is a ground-up evolution of the Spec-MAS framework. It replaces LangGraph with **OpenHands** as the orchestration and execution backbone, adds a **conversational Web UI** for spec authoring, supports **multiple AI CLI agents** (Claude Code, Codex, Gemini CLI), runs **multiple projects in parallel** with independent state, and uses **GitHub Issues** as the canonical work queue for all agent coordination.

> **Relationship to v1:** Spec-MAS v2 preserves v1's core philosophy — specification as source of truth, validation gates, adversarial review — but replaces the orchestration layer, adds multi-project support, and makes the system operable by non-CLI-native users through a conversational UI.

---

## 0) Goals & Non-Goals

### Goals

1. **OpenHands as orchestration core** — use OpenHands local Docker environments for agent execution, task routing, and workflow management, replacing LangGraph.
2. **Multi-agent CLI support** — first-class support for Claude Code, Codex, and Gemini CLI as interchangeable implementation agents.
3. **Conversational spec authoring** — Web UI where users create and refine specs through guided conversation, producing v3-compliant Markdown specs, backed by a rich template library.
4. **NPM CLI for local workflows** — `specmas` CLI triggers validation, runs, agent management, artifact access, and project operations from any developer's terminal.
5. **Project-level configuration** — per-project config files for OpenHands runtime, agent routing, workflows/gates, secrets references, and integrations.
6. **Configurable workflows and gates** — YAML-defined workflow pipelines and gate configurations, editable via UI or file. Default pipeline matches current Spec-MAS flow.
7. **Multi-project parallel execution** — run multiple projects simultaneously with independent state, agent assignments, and dashboards.
8. **GitHub Issues as work queue** — all plans decompose into GitHub Issues; all agent-to-agent communication happens via issue comments, file attachments, and label transitions.
9. **Notifications and webhooks** — event-driven notifications to Slack/email/custom endpoints, and webhook triggers for external automations.
10. **GitHub Actions integration** — workflows, validations, and agent runs can be triggered from GitHub Actions and report results back to PRs.
11. **Artifact management** — all run outputs (reports, logs, test results, patches) stored, browsable, and downloadable from both Web UI and CLI.
12. **Git-based rollback and recovery** — frequent commits and branch-per-task strategy enable automatic detection of repeated failures, disposal of bad work, and clean restarts.

### Non-Goals

- Not a hosted SaaS product (runs on user infrastructure, local Docker only for v2; remote/cloud-hosted OpenHands is a future feature)
- Not a CI/CD replacement (integrates with GitHub Actions but doesn't replace it)
- Not an LLM training or fine-tuning platform
- Not a code editor or IDE (agents use their own CLI environments)
- No vendor lock-in to a single LLM provider
- **No cost tracking, budget management, or agent performance analytics in v2** — token usage, dollar cost tracking per agent/task/project, and performance scoring/leaderboards are deferred to a future release. v2 relies on each LLM provider's native usage dashboards and the local run logs/artifacts for troubleshooting.
- **No agent performance routing in v2** — smart routing based on historical agent performance data (success rates, speed, cost efficiency per task type) is deferred. v2 uses explicit configuration for agent assignment; data-driven routing is a future feature built on execution history once sufficient data is collected.

---

## 1) Architecture Overview

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │
│  │  specmas CLI  │  │  Web Dashboard │  │  Conversational UI  │ │
│  │  (npm package)│  │  (React)       │  │  (Spec Authoring)   │ │
│  └──────┬───────┘  └───────┬───────┘  └──────────┬───────────┘ │
├─────────┴──────────────────┴──────────────────────┴─────────────┤
│                     Spec-MAS API Server                          │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Project  │  │ Workflow  │  │  Agent   │  │    Spec       │  │
│  │ Manager  │  │ Engine    │  │ Registry │  │  Manager      │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│  ┌────┴─────┐  ┌─────┴─────┐  ┌────┴─────┐  ┌──────┴───────┐  │
│  │ Artifact │  │ Rollback  │  │Webhook / │  │  Template    │  │
│  │ Manager  │  │ Manager   │  │Notify Eng│  │  Library     │  │
│  └────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
├───────┴──────────────┴─────────────┴───────────────┴────────────┤
│                    Orchestration Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │               OpenHands Runtime (Local Docker)            │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐ │   │
│  │  │Sandbox 1│  │Sandbox 2│  │Sandbox 3│  │ Sandbox N  │ │   │
│  │  │Claude   │  │Codex    │  │Gemini   │  │ (any CLI)  │ │   │
│  │  │Code     │  │         │  │CLI      │  │            │ │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └─────┬──────┘ │   │
│  └───────┴─────────────┴───────────┴──────────────┴─────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                    Integration Layer                              │
│  ┌────────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  GitHub    │  │  GitHub  │  │  MCP         │  │  Webhook  │  │
│  │  Issues    │  │  Actions │  │  Servers     │  │  System   │  │
│  └────────────┘  └──────────┘  └─────────────┘  └───────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Technology Decisions

| Concern | v1 Decision | v2 Decision | Rationale |
|---------|-------------|-------------|-----------|
| Orchestration | LangGraph | **OpenHands (local Docker)** | Sandboxed execution, built-in agent support, web UI, active community |
| Agent Execution | Claude Agent SDK | **CLI adapters** (Claude Code, Codex, Gemini CLI) | Real developer tools, not SDK wrappers; each runs in OpenHands sandbox |
| Work Queue | GitHub Issues (concept) | **GitHub Issues (enforced)** | All work is issues; all comms are comments; no separate state |
| Spec Authoring | Manual Markdown | **Conversational UI + Manual** | Lower barrier to entry; guided spec creation; template library |
| Workflow Config | Hardcoded in LangGraph | **YAML pipeline definitions** | User-configurable, versionable, sharable |
| Multi-project | Not supported | **First-class** | Independent state, dashboards per project |
| State Management | LangGraph state + git reports | **GitHub Issues + Git branches** | Issues are the state; branches are the recovery mechanism |
| CI/CD | Not integrated | **GitHub Actions** | Trigger runs on PR, validate specs on push, report results |
| Recovery | Not defined | **Git branches + auto-restart** | Frequent commits; detect failure loops; discard and restart |

---

## 2) OpenHands Integration

### 2.1 Why OpenHands

OpenHands provides:

- **Sandboxed execution environments** — each agent runs in an isolated Docker container with its own filesystem, network, and tool access
- **Built-in agent framework** — supports delegating tasks to sub-agents, tool use, and multi-step reasoning
- **Web-based observation** — real-time visibility into what agents are doing
- **Multi-agent coordination** — native support for multiple agents working on different tasks
- **Extensible runtime** — custom tools, custom agents, custom workflows

### 2.2 Deployment Model: Local Docker Only (v2)

**v2 runs OpenHands exclusively on local Docker.** The user's machine (or a team-managed server) hosts the Docker daemon. OpenHands sandboxes are Docker containers on that host.

**Why local-only for v2:**
- Simpler setup — no cloud infrastructure to provision
- Lower latency — no network round-trips to remote sandboxes
- Full control — user owns the Docker daemon, credentials, and compute
- Cost clarity — you pay for LLM API calls only, not compute hosting

**Future (post-v2): Remote/hosted OpenHands** — OpenHands-managed cloud sandboxes, Kubernetes-based sandbox pools, and multi-region execution are planned for a future release when local Docker becomes a bottleneck for teams running many concurrent projects.

### 2.3 OpenHands as Orchestration Core

OpenHands replaces LangGraph for all orchestration concerns:

**Task Execution:**
- Each agent task runs in its own OpenHands sandbox (local Docker container)
- Sandbox has the target repo cloned, CLI tools installed, and credentials configured
- Agent executes work using its native CLI (Claude Code, Codex, or Gemini CLI)
- Results (code changes, test results, artifacts) captured from sandbox

**Workflow Orchestration:**
- OpenHands manages the execution sequence defined by workflow YAML
- Handles phase transitions (parse → plan → implement → test → review)
- Manages parallel execution of independent tasks within a phase
- Handles failure recovery and escalation (see §9 Rollback & Recovery)

**State Management:**
- Run state tracked in OpenHands + mirrored to GitHub Issue comments
- Each task's progress visible in both OpenHands UI and the Spec-MAS dashboard
- Artifacts persisted to project artifact store (see §11)
- Git branches provide the durable recovery mechanism

### 2.4 OpenHands Runtime Configuration

```yaml
# openhands-config.yaml (per-project or global)
openhands:
  runtime: docker              # docker only in v2; remote/kubernetes deferred
  base_image: specmas/agent-runtime:latest
  sandbox:
    timeout_minutes: 120       # max sandbox lifetime
    memory_limit: 8g
    cpu_limit: 4
    network_access: true       # needed for GitHub API, npm, pip
    persist_workspace: true    # keep workspace between phases
  
  # Docker-specific settings
  docker:
    socket: /var/run/docker.sock
    network: specmas-net       # Shared Docker network for sandbox communication
    cleanup_on_exit: true      # Remove containers on sandbox teardown
    image_pull_policy: if_not_present
  
  # Pre-installed in base image
  tools:
    - claude-code              # Anthropic CLI
    - codex                    # OpenAI Codex CLI
    - gemini-cli               # Google Gemini CLI
    - gh                       # GitHub CLI
    - node                     # Node.js 20+
    - python3                  # Python 3.11+
    - git
```

### 2.5 Sandbox Lifecycle

```
1. PROVISION
   - OpenHands creates Docker container from base image on local host
   - Clones target repo at specified branch
   - Injects credentials (GitHub token, API keys)
   - Installs project dependencies

2. EXECUTE
   - Agent CLI runs inside container
   - Agent reads spec/issue, performs work
   - Agent commits changes to branch frequently (see §9 Rollback)
   - Agent posts results to GitHub Issue comment

3. CAPTURE
   - Container output captured (logs, artifacts, code changes)
   - Results pushed to GitHub (branch, issue comment)
   - Artifacts copied to project artifact store (see §11)

4. TEARDOWN
   - Container destroyed (or persisted for next phase)
   - Local Docker resources released
```

---

## 3) Multi-Agent CLI Support

### 3.1 Agent Adapter Architecture

Each AI CLI tool is wrapped in an adapter that normalizes its interface for Spec-MAS.

```yaml
# agents/claude-code.yaml
agent:
  id: agent-claude-code
  name: Claude Code
  provider: anthropic
  type: cli
  command: claude
  version_check: claude --version
  capabilities:
    - implement
    - review
    - test
    - refactor
  
  # CLI invocation patterns
  commands:
    implement: |
      claude --project-dir {workspace} \
        --message "Implement the following specification task: {task_description}" \
        --allowedTools Edit,Write,Bash,Read
    review: |
      claude --project-dir {workspace} \
        --message "Review the implementation against this spec: {spec_content}" \
        --allowedTools Read,Bash
    test: |
      claude --project-dir {workspace} \
        --message "Write and run tests for: {task_description}" \
        --allowedTools Edit,Write,Bash,Read
  
  # Model selection
  models:
    default: claude-sonnet-4-5
    complex: claude-opus-4-5
    simple: claude-haiku-4-5
  
  # Behavioral config
  temperature: 0.0
  max_turns: 200
  max_context_tokens: 200000
  
  enabled: true
```

```yaml
# agents/codex.yaml
agent:
  id: agent-codex
  name: OpenAI Codex CLI
  provider: openai
  type: cli
  command: codex
  version_check: codex --version
  capabilities:
    - implement
    - test
  
  commands:
    implement: |
      codex --quiet \
        --approval-mode full-auto \
        "{task_description}"
    test: |
      codex --quiet \
        "{task_description}"
  
  models:
    default: o3-mini
    complex: o3
  
  max_context_tokens: 128000
  enabled: true
```

```yaml
# agents/gemini-cli.yaml
agent:
  id: agent-gemini-cli
  name: Gemini CLI
  provider: google
  type: cli
  command: gemini
  version_check: gemini --version
  capabilities:
    - implement
    - review
    - test
  
  commands:
    implement: |
      gemini --sandbox="{workspace}" \
        --prompt "Implement: {task_description}"
    review: |
      gemini --sandbox="{workspace}" \
        --prompt "Review against spec: {spec_content}"
  
  models:
    default: gemini-2.5-pro
  
  max_context_tokens: 1000000
  enabled: true
```

### 3.2 Agent Selection and Routing

Agents are selected per-task based on a priority chain:

1. **Explicit override** — GitHub Issue label `agent:claude-code` forces a specific agent
2. **Workflow config** — workflow YAML can specify agent per phase
3. **Project config** — project-level default agent and phase-level overrides
4. **Global default** — system-wide default agent

```yaml
# Example: project-level agent routing
routing:
  default_agent: agent-claude-code
  
  # Override by phase
  phase_routing:
    implement: agent-claude-code
    test: agent-codex          # Different model reduces correlated hallucinations
    review: agent-gemini-cli   # Third vendor for independent review
  
  # Fallback chain on failure
  fallback_chain:
    - agent-claude-code
    - agent-codex
    - agent-gemini-cli
```

> **Future (post-v2):** Smart routing based on agent performance history (success rates, speed, cost per task type) will be added once sufficient execution data is collected. See Non-Goals.

---

## 4) Conversational Spec Authoring UI

### 4.1 Concept

The conversational UI guides users through spec creation via structured dialogue. Instead of staring at a blank Markdown template, users answer questions and the system generates a v3-compliant spec iteratively.

### 4.2 Conversation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Spec Authoring UI                         │
├──────────────────────────┬──────────────────────────────────┤
│   Conversation Panel     │    Live Spec Preview             │
│                          │                                   │
│ 🤖 What are you          │ ---                               │
│    building? Describe    │ specmas: v3                       │
│    the problem.          │ kind: FeatureSpec                 │
│                          │ id: feat-...                      │
│ 👤 We need a payment     │ name: Payment Processing          │
│    processing service    │ complexity: MODERATE              │
│    that handles...       │ maturity: 2                       │
│                          │ ---                               │
│ 🤖 Got it. I've drafted  │                                   │
│    the Overview. Let's   │ # Overview                        │
│    define the functional │ Let users process payments...     │
│    requirements. What    │                                   │
│    are the core actions  │ # Functional Requirements         │
│    the system must       │ ### FR-1: Process Payment         │
│    perform?              │ ...                               │
│                          │                                   │
│ 👤 It needs to validate  │                                   │
│    cards, process        │                                   │
│    charges, and handle   │                                   │
│    refunds.              │                                   │
│                          │                                   │
│ [Type your response...]  │ [Edit Spec Directly]              │
└──────────────────────────┴──────────────────────────────────┘
```

### 4.3 Authoring Modes

**Guided Mode (default for new specs):**
- System walks through each spec section in order
- Asks targeted questions per section
- Generates Markdown incrementally
- Validates as it goes (highlights missing fields, vague language)
- Suggests improvements in real-time

**Edit Mode (for existing specs):**
- User uploads or selects existing spec
- Can ask questions like "add a security section" or "make FR-3 more specific"
- System modifies spec and shows diff
- User approves or refines changes

**Freeform Mode:**
- User describes feature in natural language
- System generates complete first-draft spec
- User refines through follow-up conversation

### 4.4 Spec Template Library

The template library provides pre-built starting points that the conversational UI and `specmas spec create` command use to bootstrap new specs. Each template is a complete, valid v3 spec with placeholder content and inline guidance comments.

#### 4.4.1 Template Categories

**Application Templates:**

| Template | ID | Complexity | Description | Pre-filled Sections |
|----------|----|-----------|-------------|---------------------|
| CRUD API | `crud-api` | EASY | REST API with standard entity operations (create, read, update, delete, list) | FR for each CRUD op, API endpoints, data model, auth, DT for validation |
| Frontend Component | `frontend-component` | EASY | React/Vue/Angular component with props, state, events, and visual spec | User stories, component API, accessibility, visual examples |
| CLI Tool | `cli-tool` | EASY | Command-line utility with subcommands, flags, and help text | Command reference, argument validation, exit codes, DT for each command |
| Webhook Handler | `webhook-handler` | EASY | Receive, validate, and process incoming webhooks | Signature verification, retry handling, idempotency, security |
| Integration Service | `integration-service` | MODERATE | Service connecting to one or more external APIs with error handling | API contracts, rate limiting, circuit breaker, fallback behavior |
| Background Job | `background-job` | MODERATE | Async job processor (queue consumer, scheduled task, or event handler) | Job schema, retry policy, dead letter handling, idempotency |
| Auth System | `auth-system` | MODERATE | Authentication and authorization (login, signup, roles, tokens) | OAuth/JWT flows, role model, session management, security section |
| Multi-Service Feature | `multi-service` | HIGH | Feature spanning multiple services with contracts and coordination | Service boundaries, API contracts, data consistency, failure modes |
| Data Pipeline | `data-pipeline` | MODERATE | ETL, data processing, or streaming data workflow | Source/sink schemas, transformation logic, error handling, backpressure |
| Security-Critical | `security-critical` | HIGH | Feature handling PII, payments, encryption, or compliance requirements | Threat model, encryption spec, audit logging, compliance checklist |
| Event-Driven System | `event-driven` | HIGH | Event sourcing, pub/sub, or CQRS architecture | Event schemas, eventual consistency, replay, idempotency |
| Migration/Refactor | `migration` | MODERATE | Safely migrate data, schema, or system component | Rollback plan, data validation, feature flags, zero-downtime |

**Infrastructure Templates:**

| Template | ID | Complexity | Description |
|----------|----|-----------|-------------|
| Terraform Module | `terraform-module` | MODERATE | IaC module with variables, outputs, and examples |
| Docker Service | `docker-service` | EASY | Containerized service with Dockerfile, compose, and health checks |
| GitHub Action | `github-action` | EASY | Custom GitHub Action with inputs, outputs, and usage examples |
| Kubernetes Operator | `k8s-operator` | HIGH | Custom controller for Kubernetes resources |

#### 4.4.2 Template Structure

Every template is stored as a Markdown file in the template library directory and follows this structure:

```
templates/
├── application/
│   ├── crud-api.md
│   ├── frontend-component.md
│   ├── cli-tool.md
│   ├── webhook-handler.md
│   ├── integration-service.md
│   ├── background-job.md
│   ├── auth-system.md
│   ├── multi-service.md
│   ├── data-pipeline.md
│   ├── security-critical.md
│   ├── event-driven.md
│   └── migration.md
├── infrastructure/
│   ├── terraform-module.md
│   ├── docker-service.md
│   ├── github-action.md
│   └── k8s-operator.md
├── custom/                    # User-created templates
│   └── ...
└── template-manifest.yaml     # Registry of all templates
```

#### 4.4.3 Template Manifest

```yaml
# templates/template-manifest.yaml
templates:
  - id: crud-api
    name: CRUD API
    category: application
    complexity: EASY
    path: application/crud-api.md
    tags: [api, rest, backend, crud]
    description: REST API with standard entity operations
    sections_included:
      - overview
      - functional_requirements
      - non_functional_requirements
      - security
      - data_model
      - api_specification
      - deterministic_tests
      - acceptance_tests
    variables:
      - name: entity_name
        prompt: "What entity does this API manage?"
        example: "User"
      - name: entity_fields
        prompt: "What fields does the entity have?"
        example: "name (string), email (string), role (enum)"
      - name: auth_method
        prompt: "How should the API authenticate requests?"
        example: "JWT bearer token"
  
  - id: integration-service
    name: Integration Service
    category: application
    complexity: MODERATE
    path: application/integration-service.md
    tags: [integration, api, external, backend]
    description: Service connecting to external APIs
    variables:
      - name: external_service
        prompt: "Which external service are you integrating with?"
        example: "Stripe API"
      - name: operations
        prompt: "What operations do you need?"
        example: "Create charge, refund, list transactions"
      - name: failure_handling
        prompt: "How should failures be handled?"
        example: "Retry 3 times with exponential backoff, then dead letter"
```

#### 4.4.4 Template Usage

**CLI:**
```bash
# List available templates
specmas template list
specmas template list --category application --complexity EASY

# Show template details
specmas template show crud-api

# Create spec from template (interactive variable prompts)
specmas spec create my-users-api --template crud-api

# Create spec from template with variables inline
specmas spec create my-users-api \
  --template crud-api \
  --var entity_name=User \
  --var auth_method="JWT bearer token"

# Create spec from template in conversational UI
specmas spec author my-feature --template integration-service
# Opens browser with template pre-loaded and conversation starting from first variable
```

**Conversational UI:**
```
🤖 Let's create a new spec. Would you like to start from a template
   or describe your feature from scratch?

   Templates:
   ├── CRUD API (EASY) — REST API with entity operations
   ├── Integration Service (MODERATE) — Connect to external APIs
   ├── Auth System (MODERATE) — Login, signup, roles
   └── [Show all 16 templates...]

👤 Integration service

🤖 Great, starting from the Integration Service template.
   Which external service are you integrating with?

👤 Stripe for payment processing

🤖 Got it. I've pre-filled the spec with Stripe integration patterns.
   What operations do you need? Common ones include:
   - Create charges
   - Process refunds
   - List transactions
   - Manage customers

👤 All of those, plus webhook handling for payment events

🤖 Perfect. I've added 5 functional requirements including webhook
   handling with signature verification. Here's what the spec looks
   like so far: [live preview updates]
   
   Let's define the error handling strategy...
```

#### 4.4.5 Custom Templates

Users can create and share custom templates:

```bash
# Save current spec as a template
specmas template create my-custom-template --from specs/my-feature.md

# Export template for sharing
specmas template export my-custom-template > my-template.md

# Import shared template
specmas template import my-template.md --id team-standard-api
```

Custom templates live in `templates/custom/` and are registered in the manifest. The Web UI's template picker shows both built-in and custom templates with a "Custom" badge.

### 4.5 Validation Integration

As the spec is being authored:

- **Real-time gate checking** — G1 (structure) and G2 (semantics) run continuously
- **Ambiguity detection** — vague terms flagged immediately ("fast", "secure", "soon")
- **Completeness tracking** — progress bar shows maturity level progression
- **Suggestion engine** — AI suggests missing acceptance criteria, security considerations, edge cases
- **Template-aware hints** — if using a template, system knows which variables haven't been filled and prompts for them

### 4.6 Spec Output

The conversational UI produces:
- **v3-compliant Markdown spec** saved to the project's `specs/` directory
- **Git commit** with the spec (auto-committed to spec branch)
- **GitHub Issue(s)** created from the spec if user triggers planning

---

### 4.7 Artifacts in the Web UI

The Web UI includes an **Artifacts** surface at both the project and run levels:

- **Run artifacts panel** — browse, preview, and download outputs like gate reports, test logs, diffs/patches, and generated docs.
- **Project artifact history** — filter by run, issue/branch, phase, agent, and time; link artifacts back to the GitHub Issue/PR that produced them.
- **Parity with CLI** — everything available via `specmas artifacts ...` is discoverable in the UI, with stable permalinks for sharing inside a team.


## 5) NPM CLI (`specmas`)

### 5.1 Package Structure

```json
{
  "name": "specmas",
  "version": "2.0.0",
  "bin": {
    "specmas": "./bin/specmas.js"
  }
}
```

Installation:
```bash
npm install -g specmas
# or
npx specmas <command>
```

### 5.2 Command Reference

#### Project Management

```bash
# Initialize a new Spec-MAS project in current repo
specmas init
# Creates: .specmas/, specs/, workflows/, agents/, templates/custom/

# List all registered projects
specmas projects list

# Add existing repo as a project
specmas project add --repo https://github.com/org/repo --name "My App"

# Show project status (active runs, issues, agents)
specmas project status [project-name]

# Edit project configuration
specmas project config [project-name]
# Opens .specmas/project.yaml in $EDITOR

# Remove project (does not delete repo)
specmas project remove <project-name>
```

#### Spec Operations

```bash
# Create new spec from template
specmas spec create <n> [--template crud-api] [--complexity MODERATE]

# Validate spec against gates
specmas spec validate <spec-path> [--gates G1,G2,G3,G4] [--complexity HIGH]
# Outputs: JSON/SARIF report with findings

# Run adversarial review on spec
specmas spec review <spec-path> [--adversaries security,ambiguity,compliance]

# Show spec maturity and gaps
specmas spec status <spec-path>

# Generate traceability matrix
specmas spec traceability <spec-path> [--format json|html]

# Open conversational authoring UI for a spec
specmas spec author <spec-path> [--template integration-service]
# Opens browser to conversational UI with spec loaded
```

#### Template Operations

```bash
# List available templates
specmas template list [--category application] [--complexity EASY]

# Show template details and variables
specmas template show <template-id>

# Create custom template from existing spec
specmas template create <template-id> --from <spec-path>

# Import/export templates
specmas template export <template-id> > template.md
specmas template import template.md --id <template-id>
```

#### Workflow Operations

```bash
# Run a workflow against a spec
specmas run <spec-path> [--workflow default] [--project my-app]

# Run with specific agent
specmas run <spec-path> --agent claude-code

# Dry run (plan only, no execution)
specmas run <spec-path> --dry-run

# Resume a failed/paused run
specmas run resume <run-id>

# Stop a running workflow
specmas run stop <run-id>

# List active and recent runs
specmas runs [--project my-app] [--status running|completed|failed]

# Show run details
specmas run status <run-id>
```

#### Agent Management

```bash
# List configured agents
specmas agent list

# Show agent details
specmas agent show <agent-id>

# Add a new agent from config
specmas agent add --config agents/my-agent.yaml

# Enable/disable an agent
specmas agent enable <agent-id>
specmas agent disable <agent-id>

# Test agent connectivity
specmas agent test <agent-id>
```

#### Workflow/Gate Configuration

```bash
# List available workflows
specmas workflow list

# Show workflow definition
specmas workflow show <workflow-name>

# Validate workflow config
specmas workflow validate <workflow-path>

# Set project default workflow
specmas workflow set-default <workflow-name> [--project my-app]
```

#### GitHub Issues Integration

```bash
# Decompose spec into GitHub Issues
specmas plan <spec-path> [--project my-app]

# Show issue queue for a project
specmas issues [--project my-app] [--status open|closed]

# Show issue detail with agent comments
specmas issue show <issue-number> [--project my-app]
```

#### Artifact Operations

```bash
# List artifacts for a run
specmas artifacts list <run-id>

# Show specific artifact content
specmas artifacts show <run-id> <artifact-path>
# e.g. specmas artifacts show run-047 validation/gate-results.json

# Download artifact(s) to local filesystem
specmas artifacts download <run-id> [artifact-path] [--output ./local-dir]

# Download all artifacts for a run
specmas artifacts download <run-id> --all --output ./run-047-artifacts/

# Show run summary report
specmas artifacts summary <run-id>

# Open artifact in browser (web dashboard artifact viewer)
specmas artifacts open <run-id> [artifact-path]

# Compare artifacts between two runs
specmas artifacts diff <run-id-1> <run-id-2> [--artifact validation/gate-results.json]

# Clean up old artifacts per retention policy
specmas artifacts prune [--project my-app] [--older-than 90d]
```

#### Dashboard

```bash
# Open web dashboard in browser
specmas dashboard

# Start dashboard server (if not running)
specmas dashboard start [--port 3000]

# Show dashboard status
specmas dashboard status
```

### 5.3 Configuration

```bash
# Global config (all projects)
~/.specmas/config.yaml

# Project config (per repo)
.specmas/project.yaml

# Environment variables
SPECMAS_GITHUB_TOKEN=ghp_...
SPECMAS_ANTHROPIC_API_KEY=sk-ant-...
SPECMAS_OPENAI_API_KEY=sk-...
SPECMAS_GOOGLE_API_KEY=...
SPECMAS_OPENHANDS_URL=http://localhost:3000
SPECMAS_WEBHOOK_URL=https://hooks.slack.com/...
```

---

## 6) Configurable Workflows and Gates

### 6.1 Workflow Definition Format

Workflows are defined in YAML and stored in the project's `workflows/` directory or the global `~/.specmas/workflows/` directory.

```yaml
# workflows/default.yaml — The standard Spec-MAS workflow
workflow:
  name: default
  description: Standard Spec-MAS specification-to-implementation pipeline
  version: 1.0.0

  # Global settings
  settings:
    max_parallel_tasks: 5
    timeout_minutes: 360          # 6 hour max
    failure_policy: stop_phase    # stop_phase | stop_all | continue
    retry_policy:
      max_retries: 3
      backoff: exponential        # linear | exponential | fixed
      escalate_on_failure: true   # Try alternate agent after retries exhausted
    rollback:
      commit_frequency: per_file  # per_file | per_task | per_phase
      max_consecutive_failures: 3 # After this many, discard branch and restart
      restart_strategy: clean     # clean (new branch) | incremental (cherry-pick good commits)
  
  # Gate definitions
  gates:
    G1_structure:
      name: Structural Validation
      description: Front-matter present, required sections exist
      required: true
      checks:
        - front_matter_valid
        - required_sections_present
        - complexity_valid
        - maturity_valid
    
    G2_semantics:
      name: Semantic Validation
      description: Requirements have criteria, security coverage, no vague terms
      required: true
      checks:
        - fr_have_validation_criteria
        - security_section_complete
        - glossary_resolves_ambiguity
        - success_metrics_quantifiable
    
    G3_traceability:
      name: Traceability & Coverage
      description: FR-to-test mapping, acceptance criteria coverage
      required_for: [MODERATE, HIGH]
      checks:
        - fr_to_at_mapping
        - deterministic_tests_for_critical_paths
        - nfr_have_measurable_targets
    
    G4_determinism:
      name: Determinism & Invariants
      description: Reproducible tests, hard invariants enforced
      required_for: [HIGH]
      checks:
        - deterministic_tests_reproducible
        - security_invariants_enforced
        - no_plaintext_pii

  # Adversarial reviewers
  adversaries:
    - name: security
      enabled: true
      severity_threshold: WARN    # INFO | WARN | ERROR | CRITICAL
    - name: ambiguity
      enabled: true
      severity_threshold: WARN
    - name: compliance
      enabled: true
      severity_threshold: ERROR
    - name: data
      enabled: true
      severity_threshold: WARN
    - name: implementation
      enabled: true
      severity_threshold: INFO

  # Phase pipeline
  phases:
    - name: validate
      description: Validate spec against gates
      agent_role: validator
      gates: [G1_structure, G2_semantics, G3_traceability, G4_determinism]
      on_failure: halt
      outputs:
        - validation_report
    
    - name: plan
      description: Decompose spec into tasks, create GitHub Issues
      agent_role: planner
      requires: [validate]
      outputs:
        - task_graph
        - github_issues
    
    - name: adversarial_review
      description: Run adversarial reviewers against spec
      agent_role: reviewer
      requires: [validate]
      parallel_with: plan        # Can run in parallel with planning
      on_failure: warn           # Don't halt, but flag findings
      outputs:
        - adversarial_report
    
    - name: implement
      description: Implement code from spec tasks
      agent_role: implementer
      requires: [plan]
      parallel_tasks: true       # Independent tasks run in parallel
      max_parallel: 5
      outputs:
        - code_changes
        - branch_per_task
    
    - name: test
      description: Generate and run tests
      agent_role: tester
      requires: [implement]
      outputs:
        - test_results
        - coverage_report
    
    - name: review
      description: Review implementation against spec
      agent_role: reviewer
      requires: [test]
      outputs:
        - review_report
        - approval_status
    
    - name: report
      description: Generate final run report
      agent_role: reporter
      requires: [review]
      outputs:
        - run_summary
```

### 6.2 Custom Workflow Examples

**Fast Track (skip adversarial review, EASY specs only):**
```yaml
# workflows/fast-track.yaml
workflow:
  name: fast-track
  description: Quick pipeline for EASY specs — validate, plan, implement, test
  
  settings:
    max_parallel_tasks: 3
    timeout_minutes: 60
    failure_policy: stop_all
  
  gates:
    G1_structure:
      required: true
      checks: [front_matter_valid, required_sections_present]
    G2_semantics:
      required: true
      checks: [fr_have_validation_criteria]
  
  adversaries: []  # Skip adversarial review
  
  phases:
    - name: validate
      gates: [G1_structure, G2_semantics]
      on_failure: halt
    - name: plan
      requires: [validate]
    - name: implement
      requires: [plan]
      parallel_tasks: true
    - name: test
      requires: [implement]
```

**Review Only (validation + adversarial, no implementation):**
```yaml
# workflows/review-only.yaml
workflow:
  name: review-only
  description: Validate and review spec without implementing
  
  phases:
    - name: validate
      gates: [G1_structure, G2_semantics, G3_traceability, G4_determinism]
    - name: adversarial_review
      requires: [validate]
    - name: report
      requires: [adversarial_review]
```

### 6.3 Gate Extension

Users can define custom gate checks:

```yaml
# gates/custom-checks.yaml
custom_checks:
  require_data_model:
    description: Spec must have a Data Model section with at least one entity
    type: section_exists
    section: "Data Model"
    min_entities: 1
  
  require_api_spec:
    description: API endpoints must have request/response examples
    type: pattern_match
    section: "API Specification"
    required_patterns:
      - "Request:"
      - "Response"
  
  max_requirements:
    description: EASY specs should have ≤ 7 functional requirements
    type: count_check
    section: "Functional Requirements"
    max_count: 7
    applies_to: [EASY]
```

### 6.4 Workflow Configuration via Web UI

The dashboard provides a visual workflow editor:

```
┌─────────────────────────────────────────────────────────┐
│  Workflow Editor: default                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [validate] ──→ [plan] ──→ [implement] ──→ [test] ──→ [review]
│       │              ↑                                    │
│       └──→ [adversarial_review]                          │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  Phase: implement                                        │
│  Agent: claude-code (changeable)                         │
│  Parallel: ✓ (max 5)                                    │
│  Timeout: 120 min                                        │
│  On failure: stop_phase                                  │
│  Rollback: discard after 3 consecutive failures          │
│  [Edit Phase] [Remove Phase]                             │
│                                                          │
│  ─────────────────────────────────────────────────────── │
│  Gates: [G1 ✓] [G2 ✓] [G3 ✓] [G4 ○]                   │
│  Custom: [require_data_model ✓] [max_requirements ○]    │
│  Adversaries: [Security ✓] [Ambiguity ✓] [Compliance ✓] │
│                                                          │
│  [Save Workflow] [Export YAML] [Clone Workflow]          │
└─────────────────────────────────────────────────────────┘
```

---

## 7) Multi-Project Parallel Execution

### 7.1 Project-Level Configuration

Each project is an independent unit with its own comprehensive configuration. All project config lives in `.specmas/project.yaml` in the project repo.

```yaml
# .specmas/project.yaml — Full project configuration
project:
  id: proj-payment-service
  name: Payment Service
  repo: https://github.com/acme/payment-service
  default_branch: main

  # ─── Agent Configuration ───
  agents:
    default_agent: agent-claude-code
    
    # Phase-level agent overrides
    phase_routing:
      implement: agent-claude-code
      test: agent-codex            # Different vendor for test generation
      review: agent-gemini-cli     # Third vendor for independent review
    
    # Fallback chain when primary agent fails
    fallback_chain:
      - agent-claude-code
      - agent-codex
      - agent-gemini-cli
    
    # Agent-specific overrides for this project
    overrides:
      agent-claude-code:
        model: claude-opus-4-5     # Use Opus for this complex project
        max_turns: 300
        temperature: 0.0

  # ─── Workflow Configuration ───
  workflow:
    default: default               # Workflow name from workflows/ dir
    max_concurrent_runs: 2         # Max parallel runs for this project
    
    # Gate overrides (stricter or looser than workflow default)
    gate_overrides:
      G3_traceability:
        required: true             # Force G3 even for EASY specs in this project
      custom_gates:
        - require_api_spec         # Add project-specific custom gate
    
    # Adversarial review overrides
    adversary_overrides:
      security:
        severity_threshold: ERROR  # Stricter security for payment service
      compliance:
        enabled: true
        severity_threshold: WARN

  # ─── Rollback & Recovery ───
  recovery:
    commit_frequency: per_file     # per_file | per_task | per_phase
    max_consecutive_failures: 3    # Discard branch and restart after this many
    restart_strategy: clean        # clean | incremental
    max_restarts_per_task: 2       # Give up on a task after this many full restarts

  # ─── Notifications ───
  notifications:
    channels:
      - type: slack
        webhook: ${SLACK_WEBHOOK_PAYMENT_TEAM}
        events: [run.completed, run.failed, agent.escalated, recovery.restart]
        format: rich
      - type: email
        address: payments-team@acme.com
        events: [run.failed, recovery.exhausted]
      - type: github
        events: [run.completed, run.failed]
        action: create_pr_comment
    
    # Notification filtering
    filters:
      suppress_duplicate_minutes: 15    # Don't re-notify same event within window
      escalation_delay_minutes: 30      # Wait before escalating to email

  # ─── GitHub Integration ───
  github:
    issue_labels_prefix: specmas       # Labels will be specmas/spec:..., specmas/phase:...
    auto_create_pr: true               # Auto-create PR from agent branches
    pr_template: .specmas/pr-template.md
    required_reviewers: [team-lead]    # Humans who must approve agent PRs
    branch_naming: "specmas/{run_id}/{issue_number}"
    
    # GitHub Actions integration
    actions:
      validate_on_push: true           # Run spec validation on push to specs/
      validate_on_pr: true             # Run validation as PR check
      plan_on_label: "specmas:plan"    # Create issues when PR gets this label
      run_on_label: "specmas:run"      # Trigger full workflow when PR gets this label

  # ─── Artifact Configuration ───
  artifacts:
    store_path: .specmas/artifacts     # Local artifact store (relative to repo)
    retention:
      default: 90_days
      run_metadata: forever
      agent_logs: 30_days
      test_results: 90_days
      spec_snapshots: forever

  # ─── Project Metadata ───
  metadata:
    language: typescript
    framework: express
    test_runner: jest
    package_manager: npm
    description: "Payment processing microservice"
    team: payments
    tags: [backend, payments, pci]
```

### 7.2 Configuration Inheritance

Configuration resolves through a cascade:

```
Global defaults (~/.specmas/config.yaml)
  └── overridden by Project config (.specmas/project.yaml)
      └── overridden by Workflow config (workflows/*.yaml)
          └── overridden by CLI flags (--agent, --workflow, etc.)
              └── overridden by GitHub Issue labels (agent:codex)
```

### 7.3 Multi-Project Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  Spec-MAS Dashboard                            [+ New Project]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PROJECT: Payment Service              STATUS: 🟢 2 runs active  │
│  ├─ Run #47: feat-refund-flow          Phase: implement (3/5)    │
│  │   Agent: claude-code                Issues: 5 open, 2 done    │
│  │   [View Artifacts]                  ETA: ~45 min              │
│  │                                                                │
│  ├─ Run #46: feat-subscription         Phase: test               │
│  │   Agent: codex                      Issues: 3 open, 4 done    │
│  │   [View Artifacts]                                             │
│  │                                                                │
│  PROJECT: User Service                 STATUS: 🟡 1 run recovering│
│  ├─ Run #12: feat-sso-integration      Phase: implement (RESTART) │
│  │   Reason: 3 consecutive failures on issue #45                  │
│  │   Action: Discarded branch, restarting clean (attempt 2/2)     │
│  │   [View Failure Log] [View Artifacts]                          │
│  │                                                                │
│  PROJECT: Frontend App                 STATUS: 🔴 1 run failed   │
│  ├─ Run #33: feat-dashboard-redesign   Phase: test (FAILED)      │
│  │   Error: Exhausted restarts on issue #78 (2/2 attempts)       │
│  │   Action: [View Failures] [Retry with Opus] [Assign Human]   │
│  │   [View Artifacts] [Download Report]                           │
│  │                                                                │
│  PROJECT: Data Pipeline                STATUS: ⚪ Idle            │
│  │   Last run: 2 days ago (completed)                             │
│  │   [View Last Run Artifacts] [Start New Run]                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.4 Project Isolation

Each project operates independently:

- **Separate OpenHands sandbox pools** — no cross-project resource contention
- **Separate GitHub Issue namespaces** — issues are per-repo, naturally isolated
- **Separate agent configs** — different projects can use different agents/models/overrides
- **Separate artifact stores** — each project's outputs stored independently
- **Separate notification channels** — each project alerts its own team
- **Separate recovery policies** — each project can have different failure tolerance

### 7.5 Cross-Project View

The dashboard provides a global view across all projects:

- **Portfolio status** — all projects at a glance with health indicators
- **Agent utilization** — which agents are busy, idle, or errored across projects
- **Global alerts** — failures, recovery events, and escalations from all projects in one feed
- **Artifact search** — find artifacts across all projects by type, date, or content

---

## 8) GitHub Issues as Work Queue

### 8.1 Issue Creation from Spec

When a workflow reaches the `plan` phase, the spec is decomposed into GitHub Issues:

```
Spec: feat-payment-processing.md
  ↓
Issue #101: [feat-payment] FR-1: Validate payment card
  Labels: specmas/spec:feat-payment, specmas/phase:implement, specmas/agent:claude-code, specmas/area:backend

Issue #102: [feat-payment] FR-2: Process payment charge
  Labels: specmas/spec:feat-payment, specmas/phase:implement, specmas/agent:claude-code, specmas/area:backend
  Dependencies: #101

Issue #103: [feat-payment] FR-3: Handle refunds
  Labels: specmas/spec:feat-payment, specmas/phase:implement, specmas/agent:claude-code, specmas/area:backend
  Dependencies: #102

Issue #104: [feat-payment] Test suite for payment processing
  Labels: specmas/spec:feat-payment, specmas/phase:test, specmas/agent:codex, specmas/area:tests
  Dependencies: #101, #102, #103

Issue #105: [feat-payment] Code review against spec
  Labels: specmas/spec:feat-payment, specmas/phase:review, specmas/agent:gemini-cli, specmas/area:review
  Dependencies: #104
```

### 8.2 Issue Template

```markdown
## [spec-id] Task Summary

**Spec:** [link to spec file]
**Run ID:** run-047
**Phase:** implement
**Complexity:** MODERATE

### Scope
[What to build — extracted from FR description and validation criteria]

### Acceptance Criteria
- [ ] Given valid card number, When validate is called, Then return success
- [ ] Given expired card, When validate is called, Then return error with reason
- [ ] Given invalid format, When validate is called, Then return validation error

### Definition of Done
- [ ] All acceptance criteria passing
- [ ] Unit tests written and passing
- [ ] No linting errors
- [ ] Code committed to feature branch
- [ ] Agent posted completion comment

### Dependencies
- Depends on: #101 (card validation must be complete first)

### Context
[Link to spec section, relevant architecture notes, existing code references]
```

### 8.3 Agent Communication via Issue Comments

All agent-to-agent communication happens through structured issue comments:

**Status Update (posted by executing agent):**
```markdown
@specmas-bot STATUS: STARTED
**Run:** run-047
**Agent:** claude-code (claude-sonnet-4-5)
**Phase:** implement
**Issue:** #102

### Progress
- Reading spec and dependencies...
- Implementing payment charge logic
- Completeness: 40%

### Commits
- `abc1234` — Add charge service skeleton
- `def5678` — Implement Stripe integration

### Next
- Complete charge logic
- Add error handling
- Run local tests
```

**Completion Comment:**
```markdown
@specmas-bot STATUS: PASS
**Run:** run-047
**Agent:** claude-code (claude-sonnet-4-5)
**Phase:** implement
**Completeness:** 100%

### Summary
Implemented payment charge processing with Stripe integration.

### Commits (5 total)
- `abc1234` — Add charge service skeleton
- `def5678` — Implement Stripe integration
- `ghi9012` — Add error handling
- `jkl3456` — Add unit tests (8 passing)
- `mno7890` — Clean up and lint fixes

### Branch
`specmas/run-047/issue-102`

### Artifacts
- [Implementation report](link-to-artifact)
- [Test results](link-to-artifact)

### Next
- Ready for: #104 (test suite) and #105 (code review)
```

**Failure + Recovery Comment:**
```markdown
@specmas-bot STATUS: FAIL
**Run:** run-047
**Agent:** claude-code (claude-sonnet-4-5)
**Phase:** implement
**Completeness:** 65%
**Consecutive Failures:** 2 of 3

### Error
Test `should handle concurrent charges` failing — race condition in charge ID generation.

### Recovery History
1. Attempt 1: Mutex lock approach — failed (deadlock in tests)
2. Attempt 2: UUID approach — failed (Stripe rejects non-sequential IDs)

### Commits (will be discarded if next attempt fails)
- `pqr1234` — Attempt mutex lock (REVERTED)
- `stu5678` — Attempt UUID generation (FAILING)

### Next
- 1 retry remaining before branch discard and clean restart
- If restart also fails: escalate to alternate agent (codex) or human
```

**Handoff Comment (agent-to-agent):**
```markdown
@specmas-bot STATUS: HANDOFF
**From:** claude-code (implement)
**To:** codex (test)
**Run:** run-047

### Context for Test Agent
Implementation complete on branch `specmas/run-047/issue-102`.

Key areas to test:
1. Charge creation with valid/invalid cards
2. Concurrent charge handling (was tricky — see charge.ts:L45-67)
3. Error propagation from Stripe API
4. Idempotency key handling

### Spec Reference
See FR-2 validation criteria in `specs/feat-payment-processing.md`
```

### 8.4 Issue State Machine

```
                    ┌──────────┐
                    │  Created  │
                    └─────┬────┘
                          │ agent picks up
                    ┌─────▼────┐
               ┌────│ In Progress│────┐
               │    └─────┬────┘     │
               │          │          │
          blocked    completed    failed
               │          │          │
          ┌────▼───┐ ┌───▼────┐ ┌──▼────────┐
          │Blocked │ │  Done  │ │Recovering │
          └────┬───┘ └───┬────┘ └──┬────────┘
               │         │         │
          unblocked   verified   restart / fallback
               │         │         │
               └────►────┘    ┌───▼────┐
                              │Retrying│
                              └───┬────┘
                                  │
                         success/fail (→ Done or escalate to human)
```

**Labels for state tracking:**
- `specmas/status:created`, `specmas/status:in-progress`, `specmas/status:blocked`, `specmas/status:done`, `specmas/status:failed`, `specmas/status:recovering`
- `specmas/phase:validate`, `specmas/phase:plan`, `specmas/phase:implement`, `specmas/phase:test`, `specmas/phase:review`
- `specmas/agent:claude-code`, `specmas/agent:codex`, `specmas/agent:gemini-cli`
- `specmas/spec:<spec-id>`
- `specmas/run:<run-id>`
- `specmas/area:backend`, `specmas/area:frontend`, `specmas/area:tests`, `specmas/area:docs`, `specmas/area:infra`
- `specmas/priority:high`, `specmas/priority:medium`, `specmas/priority:low`

---

## 9) Rollback & Recovery

### 9.1 Design Principle

Recovery is built on **git branches and frequent commits**. Every agent is required to commit early and often. When failures are detected, the system can discard bad work by resetting the branch and restarting cleanly. No separate state database or checkpoint system — git is the checkpoint system.

### 9.2 Branch Strategy

```
main
├── specmas/run-047/plan             # Planning phase output
├── specmas/run-047/issue-101        # One branch per task
├── specmas/run-047/issue-102        # Isolated work per issue
├── specmas/run-047/issue-103
├── specmas/run-047/integration      # Merge branch for completed tasks
└── specmas/run-047/release          # Final merged output (agent PR target)
```

Each task gets its own branch. Agents commit frequently to their task branch. The integration branch merges completed task branches. If a task branch goes bad, only that branch is discarded — other tasks are unaffected.

### 9.3 Commit Frequency

Agents are instructed to commit after every meaningful unit of work:

```yaml
commit_frequency: per_file     # Options:
                               # per_file — commit after each file created/modified
                               # per_task — commit when task substep completes
                               # per_phase — commit at end of phase only (not recommended)
```

Commit messages follow a structured format:
```
specmas(run-047/issue-102): [description]

Agent: claude-code
Phase: implement
Status: in-progress | complete | failing
```

### 9.4 Failure Detection

The system tracks consecutive failures per task:

```
Failure Conditions:
- Tests fail after implementation
- Agent hits context limit without completing
- Agent produces code that doesn't compile/lint
- Agent exceeds timeout
- Same error appears in 2+ consecutive attempts

Failure Counter:
  attempt 1: agent retries (same agent, same branch)
  attempt 2: agent retries with fresh approach
  attempt 3: THRESHOLD — trigger recovery
```

### 9.5 Automatic Recovery Flow

```
Failure detected (3 consecutive on same task)
  │
  ├── Step 1: DISCARD bad work
  │   - Reset task branch to last known good commit
  │   - If no good commits exist, delete task branch entirely
  │   - Post recovery comment on GitHub Issue
  │
  ├── Step 2: RESTART
  │   - Create fresh task branch from integration branch
  │   - Re-read spec and issue requirements
  │   - Agent starts implementation from scratch
  │   - Different approach encouraged (system prompt includes failure history)
  │
  ├── Step 3: If restart also fails (max_restarts_per_task reached)
  │   │
  │   ├── Option A: FALLBACK to alternate agent
  │   │   - Try next agent in fallback_chain
  │   │   - Fresh branch, clean start
  │   │   - New agent gets failure history as context
  │   │
  │   └── Option B: ESCALATE to human
  │       - Post detailed failure report to GitHub Issue
  │       - Send notification (Slack/email)
  │       - Label issue: specmas/status:needs-human
  │       - Workflow continues for other tasks; this one blocks
  │
  └── Recovery metadata recorded in run artifacts
```

### 9.6 Recovery Configuration

```yaml
# In workflow YAML or project config
recovery:
  # How often agents should commit
  commit_frequency: per_file
  
  # When to trigger automatic recovery
  max_consecutive_failures: 3
  
  # What to do on recovery
  restart_strategy: clean        # clean — fresh branch, start over
                                 # incremental — keep good commits, retry from failure point
  
  # How many times to restart before giving up
  max_restarts_per_task: 2
  
  # After restarts exhausted
  on_exhaustion: fallback_then_escalate   # fallback_then_escalate | escalate_immediately | skip_task
  
  # Include failure history in restart prompt
  include_failure_context: true   # Tell the restarted agent what went wrong before
  failure_context_max_lines: 50   # Limit how much failure context to include
```

### 9.7 Recovery Visibility

Recovery events appear in:

- **GitHub Issue comments** — each recovery step posted as a structured comment
- **Dashboard** — project and run views show recovery status with yellow indicators
- **CLI** — `specmas run status <run-id>` shows recovery events inline
- **Notifications** — `recovery.restart` and `recovery.exhausted` events fire to configured channels
- **Artifacts** — recovery history saved in `phases/<phase>/issue-<N>/recovery-log.json`

---

## 10) Notifications and Webhooks

### 10.1 Architecture

The notification system is an event-driven pipeline. Every significant action in Spec-MAS emits an event. Events are matched against notification rules and dispatched to configured channels.

```
Event Source → Event Bus → Rule Matcher → Channel Dispatcher → Delivery
  (run engine,      │           │              │
   agent sandbox,   │     per-project     ┌────┴─────┐
   recovery mgr,    │     + global rules  │  Slack   │
   GitHub webhook)  │                     │  Email   │
                    │                     │  Webhook │
                    │                     │  GitHub  │
                    └─────────────────────└──────────┘
```

### 10.2 Event Types

```yaml
events:
  # ─── Run Lifecycle ───
  run.started:
    description: Workflow run has begun
    payload: [project_id, run_id, spec_path, workflow_name]
  run.phase_started:
    description: A new phase has begun
    payload: [project_id, run_id, phase_name, agent_id]
  run.phase_completed:
    description: A phase has completed successfully
    payload: [project_id, run_id, phase_name, duration_seconds, tasks_completed]
  run.completed:
    description: Entire workflow run has finished successfully
    payload: [project_id, run_id, duration_seconds, tasks_total, artifacts_url]
  run.failed:
    description: Workflow run has failed and cannot continue
    payload: [project_id, run_id, phase_name, error_message, failure_count]
  run.paused:
    description: Workflow run has been paused (manual or automatic)
    payload: [project_id, run_id, reason]

  # ─── Agent Events ───
  agent.task_started:
    description: Agent has picked up a task
    payload: [project_id, run_id, agent_id, issue_number, task_description]
  agent.task_completed:
    description: Agent has finished a task successfully
    payload: [project_id, run_id, agent_id, issue_number, duration_seconds]
  agent.task_failed:
    description: Agent has failed a task
    payload: [project_id, run_id, agent_id, issue_number, error_message, retry_count]
  agent.escalated:
    description: Task escalated to human after exhausting retries
    payload: [project_id, run_id, agent_id, issue_number, failure_history]

  # ─── Recovery Events ───
  recovery.branch_discarded:
    description: Bad branch discarded due to repeated failures
    payload: [project_id, run_id, issue_number, branch_name, failure_count]
  recovery.restart:
    description: Task restarting with clean branch
    payload: [project_id, run_id, issue_number, restart_attempt, max_restarts]
  recovery.fallback:
    description: Falling back to alternate agent
    payload: [project_id, run_id, issue_number, from_agent, to_agent]
  recovery.exhausted:
    description: All recovery options exhausted, needs human intervention
    payload: [project_id, run_id, issue_number, total_attempts]

  # ─── Spec Events ───
  spec.created:
    description: New spec created
    payload: [project_id, spec_path, complexity, template_used]
  spec.validated:
    description: Spec passed all required gates
    payload: [project_id, spec_path, gates_passed]
  spec.validation_failed:
    description: Spec failed one or more gates
    payload: [project_id, spec_path, gates_failed, findings]

  # ─── GitHub Events ───
  issue.created:
    description: GitHub Issue created from spec decomposition
    payload: [project_id, run_id, issue_number, issue_url]
  issue.completed:
    description: GitHub Issue marked as done
    payload: [project_id, run_id, issue_number]
  issue.blocked:
    description: GitHub Issue blocked on dependency
    payload: [project_id, run_id, issue_number, blocked_by]
  
  # ─── GitHub Actions Events ───
  actions.validation_passed:
    description: GitHub Actions spec validation check passed
    payload: [project_id, pr_number, spec_path]
  actions.validation_failed:
    description: GitHub Actions spec validation check failed
    payload: [project_id, pr_number, spec_path, findings]
```

### 10.3 Notification Channel Configuration

Channels are configured per-project in `.specmas/project.yaml` (see §7.1) and/or globally in `~/.specmas/config.yaml`.

```yaml
# Global notification config (~/.specmas/config.yaml)
notifications:
  global_channels:
    - type: slack
      name: ops-alerts
      webhook: ${SLACK_WEBHOOK_OPS}
      events: [recovery.exhausted, run.failed]
      format: rich
    
    - type: email
      name: admin-alerts
      address: admin@acme.com
      events: [recovery.exhausted]
  
  # Global filters
  global_filters:
    quiet_hours:
      enabled: false
      start: "22:00"
      end: "07:00"
      timezone: America/Los_Angeles
      during_quiet: queue       # queue | drop | emergency_only
    
    rate_limit:
      max_per_channel_per_hour: 30
      burst_limit: 10           # Max notifications in 1 minute
```

### 10.4 Channel Types

**Slack:**
```yaml
- type: slack
  webhook: https://hooks.slack.com/services/T00/B00/xxx
  events: [run.completed, run.failed, recovery.restart, agent.escalated]
  format: rich                  # rich (blocks/attachments) | simple (plain text)
  channel_override: "#specmas-alerts"  # Optional: override webhook default channel
  mention_on_failure: "@here"   # Optional: who to ping on failures
```

**Email:**
```yaml
- type: email
  address: team@acme.com        # Single address or comma-separated list
  events: [run.failed, recovery.exhausted]
  smtp:                          # Optional: custom SMTP (default: system sendmail)
    host: smtp.gmail.com
    port: 587
    user: ${SMTP_USER}
    pass: ${SMTP_PASS}
```

**Generic Webhook:**
```yaml
- type: webhook
  url: https://api.myapp.com/specmas/events
  events: ["*"]                 # All events
  method: POST
  headers:
    Authorization: "Bearer ${WEBHOOK_TOKEN}"
    Content-Type: application/json
  retry:
    max_retries: 3
    backoff_seconds: [5, 30, 120]
  # Payload is JSON event object with type, timestamp, and event-specific payload
```

**GitHub (PR Comments and Check Runs):**
```yaml
- type: github
  events: [run.completed, run.failed, actions.validation_failed]
  actions:
    run.completed: create_pr_comment    # Comment on the PR with run results
    run.failed: create_pr_comment       # Comment on PR with failure details
    actions.validation_failed: create_check_run  # Create GitHub Check Run (red X)
```

### 10.5 Notification Message Examples

**Slack — Run Complete:**
```
🟢 Spec-MAS Run Complete

Project: Payment Service
Run: #47 — feat-refund-flow
Duration: 1h 23m

Results:
  ✅ 5 tasks completed
  ✅ 45 tests passing (94% coverage)
  ✅ Code review: approved
  
Issues: github.com/acme/payment-service/issues?label=specmas/run:047
Branch: specmas/run-047/release
Artifacts: [View in Dashboard]

[View Dashboard] [View Artifacts] [View PR]
```

**Slack — Recovery Event:**
```
🟡 Spec-MAS Recovery — Branch Discarded

Project: User Service
Run: #12 — feat-sso-integration
Task: Issue #45 — Implement SAML handler

What happened:
  ❌ 3 consecutive failures on SAML token parsing
  🗑️ Branch specmas/run-012/issue-45 discarded
  🔄 Restarting clean (attempt 1 of 2)
  
Failure history attached to issue #45

[View Issue] [View Failure Log]
```

**Slack — Needs Human:**
```
🔴 Spec-MAS — Human Intervention Required

Project: Frontend App  @here
Run: #33 — feat-dashboard-redesign
Task: Issue #78 — Implement chart component

All recovery options exhausted:
  ❌ claude-code: 3 failures + 2 restarts
  ❌ codex (fallback): 3 failures + 1 restart
  
Error: D3.js integration produces incorrect axis scaling
Last agent notes attached to issue #78

[Assign to Human] [View Issue] [View Artifacts]
```

---

## 11) Artifact Management

### 11.1 Artifact Store Structure

Every run produces artifacts that are stored locally within the project and browsable from both the Web UI and CLI.

```
.specmas/artifacts/
├── run-047/
│   ├── run.json                        # Run metadata and final state
│   ├── spec-snapshot.md                # Spec as it was at run start
│   ├── task-graph.json                 # Decomposed tasks and dependencies
│   ├── validation/
│   │   ├── gate-results.json           # G1-G4 results
│   │   ├── gate-results.sarif          # SARIF format for IDE integration
│   │   └── gate-summary.md            # Human-readable gate summary
│   ├── adversarial/
│   │   ├── security-findings.json
│   │   ├── ambiguity-findings.json
│   │   ├── compliance-findings.json
│   │   └── adversarial-summary.md      # Human-readable summary
│   ├── phases/
│   │   ├── implement/
│   │   │   ├── issue-101/
│   │   │   │   ├── agent-log.jsonl     # Full agent execution log
│   │   │   │   ├── changes.patch       # Git diff of changes made
│   │   │   │   ├── result.json         # Structured task result
│   │   │   │   └── recovery-log.json   # Recovery events (if any)
│   │   │   └── issue-102/
│   │   │       └── ...
│   │   ├── test/
│   │   │   ├── test-results.json       # Structured test results
│   │   │   ├── test-results.junit.xml  # JUnit XML for CI integration
│   │   │   ├── coverage-report.json    # Coverage data
│   │   │   └── coverage-report.html    # Visual coverage report
│   │   └── review/
│   │       ├── review-report.json      # Structured review findings
│   │       └── review-report.md        # Human-readable review
│   └── run-summary.md                  # Human-readable final report
├── run-046/
│   └── ...
```

### 11.2 Artifact Retention

```yaml
artifact_retention:
  default: 90_days
  run_metadata: forever          # run.json, run-summary.md always kept
  agent_logs: 30_days            # Verbose logs pruned after 30 days
  test_results: 90_days
  code_patches: 90_days
  spec_snapshots: forever
  recovery_logs: 60_days
```

### 11.3 Artifact Display — Web UI

The Web Dashboard includes a full artifact browser:

**Run Artifacts View:**
```
┌──────────────────────────────────────────────────────────────────┐
│  Run #47 — feat-refund-flow                    Artifacts         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  📄 Run Summary                              [View] [Download]   │
│  📄 Spec Snapshot (feat-refund-flow.md)      [View] [Download]   │
│                                                                   │
│  📁 Validation                                                    │
│  ├── 📊 Gate Results (G1 ✓ G2 ✓ G3 ✓ G4 ✓)  [View] [Download]  │
│  └── 📄 Gate Summary                         [View]              │
│                                                                   │
│  📁 Adversarial Review                                            │
│  ├── 🔒 Security (2 findings)                [View]              │
│  ├── 🔍 Ambiguity (0 findings)               [View]              │
│  └── 📄 Summary                              [View] [Download]   │
│                                                                   │
│  📁 Phase: implement                                              │
│  ├── 📁 Issue #101 — Validate card           ✅ Complete          │
│  │   ├── 📜 Agent Log (342 lines)            [View] [Download]   │
│  │   ├── 📝 Changes (+142 lines)             [View Diff]         │
│  │   └── 📄 Result                           [View]              │
│  ├── 📁 Issue #102 — Process charge          ✅ Complete          │
│  │   ├── 📜 Agent Log (567 lines)            [View] [Download]   │
│  │   ├── 📝 Changes (+210 lines)             [View Diff]         │
│  │   ├── 📄 Result                           [View]              │
│  │   └── ⚠️ Recovery Log (1 restart)          [View]              │
│  └── 📁 Issue #103 — Handle refunds          ✅ Complete          │
│                                                                   │
│  📁 Phase: test                                                   │
│  ├── 📊 Test Results (45 pass, 0 fail)       [View]              │
│  ├── 📊 Coverage (94%)                       [View HTML Report]  │
│  └── 📄 JUnit XML                            [Download]          │
│                                                                   │
│  📁 Phase: review                                                 │
│  └── 📄 Review Report                        [View] [Download]   │
│                                                                   │
│  ─────────────────────────────────────────────────────────────── │
│  [Download All as ZIP]  [Compare with Run #46]  [Open in Terminal]│
└──────────────────────────────────────────────────────────────────┘
```

**Artifact Viewer (inline):**
- **Markdown files** — rendered with syntax highlighting
- **JSON files** — rendered with collapsible tree view and syntax highlighting
- **SARIF files** — rendered as annotated findings list
- **Patch/diff files** — rendered with side-by-side diff view (green/red highlighting)
- **HTML files** — rendered in iframe (e.g., coverage reports)
- **JUnit XML** — rendered as pass/fail test tree
- **JSONL logs** — rendered as scrollable log viewer with timestamp filtering and search
- **Recovery logs** — rendered as timeline with failure/restart events

### 11.4 Artifact Display — CLI

```bash
# List artifacts with tree view
$ specmas artifacts list run-047
run-047/
├── run.json
├── spec-snapshot.md
├── run-summary.md
├── validation/
│   ├── gate-results.json
│   ├── gate-results.sarif
│   └── gate-summary.md
├── adversarial/
│   └── ...
├── phases/
│   ├── implement/
│   │   ├── issue-101/ (3 files)
│   │   ├── issue-102/ (4 files, includes recovery-log.json)
│   │   └── issue-103/ (3 files)
│   ├── test/ (4 files)
│   └── review/ (2 files)
└── 14 directories, 23 files

# View artifact content (pretty-printed)
$ specmas artifacts show run-047 validation/gate-results.json
{
  "G1_structure": { "status": "PASS", "checks": [...] },
  "G2_semantics": { "status": "PASS", "checks": [...] },
  "G3_traceability": { "status": "PASS", "coverage": "94%" },
  "G4_determinism": { "status": "PASS", "tests": 5 }
}

# View run summary (human-readable)
$ specmas artifacts summary run-047
═══════════════════════════════════════════════
  Run #47 — feat-refund-flow
  Status: ✅ Completed
  Duration: 1h 23m
  
  Validation: All gates passed (G1-G4)
  Adversarial: 2 security findings (WARN), 0 blockers
  
  Implementation: 3 tasks completed
    Issue #101: ✅ Validate card (12m)
    Issue #102: ✅ Process charge (34m, 1 recovery restart)
    Issue #103: ✅ Handle refunds (22m)
  
  Tests: 45 passing, 0 failing, 94% coverage
  Review: Approved
  
  Branch: specmas/run-047/release
  PR: github.com/acme/payment-service/pull/89
═══════════════════════════════════════════════

# Download artifacts
$ specmas artifacts download run-047 --all --output ./run-047-export/
Downloaded 23 files to ./run-047-export/

# View diff between runs
$ specmas artifacts diff run-046 run-047 --artifact validation/gate-results.json
--- run-046/validation/gate-results.json
+++ run-047/validation/gate-results.json
@@ -3,7 +3,7 @@
   "G3_traceability": {
-    "coverage": "87%"
+    "coverage": "94%"
   }

# Open artifact in browser
$ specmas artifacts open run-047 phases/test/coverage-report.html
# Opens http://localhost:3000/artifacts/run-047/phases/test/coverage-report.html
```

---

## 12) GitHub Actions Integration

### 12.1 Overview

Spec-MAS integrates with GitHub Actions to automate validation, planning, and workflow execution as part of the normal PR/merge cycle. This is not a replacement for CI/CD — it's a bridge that lets Spec-MAS participate in the GitHub development workflow.

### 12.2 Provided GitHub Actions

Spec-MAS ships reusable GitHub Actions that projects can reference in their workflows:

**`specmas/validate-spec`** — Validate specs on push or PR

```yaml
# .github/workflows/specmas-validate.yml
name: Spec-MAS Validate

on:
  push:
    paths: ['specs/**']
  pull_request:
    paths: ['specs/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: specmas/validate-spec@v2
        with:
          spec_paths: specs/
          gates: G1,G2,G3           # Which gates to enforce
          complexity: auto          # auto-detect from spec front-matter
          fail_on: ERROR            # ERROR | WARN | INFO
          report_format: sarif      # sarif | json | markdown
      
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: specmas-results.sarif
```

**`specmas/adversarial-review`** — Run adversarial review on PR

```yaml
# .github/workflows/specmas-review.yml
name: Spec-MAS Adversarial Review

on:
  pull_request:
    types: [labeled]

jobs:
  review:
    if: contains(github.event.label.name, 'specmas:review')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: specmas/adversarial-review@v2
        with:
          spec_paths: specs/
          adversaries: security,ambiguity,compliance
          severity_threshold: WARN
          comment_on_pr: true       # Post findings as PR comment
        env:
          SPECMAS_ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**`specmas/plan`** — Decompose spec into GitHub Issues

```yaml
# .github/workflows/specmas-plan.yml
name: Spec-MAS Plan

on:
  pull_request:
    types: [labeled]

jobs:
  plan:
    if: contains(github.event.label.name, 'specmas:plan')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: specmas/plan@v2
        with:
          spec_path: ${{ github.event.pull_request.body }}  # Or detect from changed files
          create_issues: true
          label_prefix: specmas
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**`specmas/run`** — Trigger full workflow run

```yaml
# .github/workflows/specmas-run.yml
name: Spec-MAS Run

on:
  pull_request:
    types: [labeled]

jobs:
  run:
    if: contains(github.event.label.name, 'specmas:run')
    runs-on: ubuntu-latest       # Or self-hosted with Docker for OpenHands
    steps:
      - uses: actions/checkout@v4
      
      - uses: specmas/run@v2
        with:
          spec_path: auto         # Auto-detect from PR
          workflow: default
          openhands_url: ${{ secrets.OPENHANDS_URL }}
          wait_for_completion: false  # Don't block PR; results posted as comments
        env:
          SPECMAS_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SPECMAS_ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 12.3 PR Integration

When GitHub Actions are configured, the PR experience looks like:

```
PR #89: Add payment refund processing
────────────────────────────────────
  ✅ Spec-MAS Validate — All gates passed (G1-G4)
  ⚠️  Spec-MAS Adversarial Review — 2 findings (WARN)
  🔄 Spec-MAS Run — In progress (implement phase, 3/5 tasks)
  
  Comments:
  ┌─────────────────────────────────────────────────────┐
  │ 🤖 specmas-bot                                      │
  │                                                      │
  │ **Spec Validation Passed** ✅                        │
  │ Gates: G1 ✓ G2 ✓ G3 ✓ G4 ✓                         │
  │ Complexity: MODERATE | Maturity: 4                   │
  │ [View Full Report](link-to-artifacts)                │
  └─────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────┐
  │ 🤖 specmas-bot                                      │
  │                                                      │
  │ **Adversarial Review** ⚠️                            │
  │ Security: 2 findings (WARN)                          │
  │  - Missing rate limiting on refund endpoint          │
  │  - No idempotency key for refund requests            │
  │ [View Full Findings](link-to-artifacts)              │
  └─────────────────────────────────────────────────────┘
```

### 12.4 Project-Level GitHub Actions Config

Projects opt into GitHub Actions integration via `.specmas/project.yaml`:

```yaml
# In .specmas/project.yaml
github:
  actions:
    validate_on_push: true        # Auto-validate when specs/ changes
    validate_on_pr: true          # Validate as PR check
    adversarial_on_label: "specmas:review"   # Trigger on label
    plan_on_label: "specmas:plan"            # Create issues on label
    run_on_label: "specmas:run"              # Full run on label
    
    # Check run behavior
    check_run:
      conclusion_on_warn: neutral   # success | neutral | failure
      conclusion_on_error: failure
      include_annotations: true     # Annotate spec files with findings
```

---

## 13) Security

### 13.1 Credential Management

```yaml
credentials:
  storage: environment          # environment only in v2; vault/secrets_manager deferred
  
  required:
    SPECMAS_GITHUB_TOKEN:
      scope: repo               # Minimum GitHub scope needed
      used_by: [issue_manager, agent_sandboxes, github_actions]
    
    SPECMAS_ANTHROPIC_API_KEY:
      used_by: [agent-claude-code]
    
    SPECMAS_OPENAI_API_KEY:
      used_by: [agent-codex]
    
    SPECMAS_GOOGLE_API_KEY:
      used_by: [agent-gemini-cli]
  
  sandbox_injection:
    method: environment_variable
    scope: per_agent              # Only inject keys the agent needs
```

### 13.2 Sandbox Security

- **Network isolation** — sandboxes can reach GitHub API, npm/pip registries, and LLM APIs; nothing else
- **Filesystem isolation** — each sandbox (Docker container) has its own filesystem; no cross-sandbox access
- **Credential scoping** — each sandbox only receives the API keys it needs
- **Resource limits** — memory, CPU, and time limits per sandbox
- **Audit logging** — all sandbox operations logged
- **Local Docker only** — sandboxes run on user-controlled infrastructure

### 13.3 Access Control

```yaml
access_control:
  roles:
    admin:
      permissions: [all]
    operator:
      permissions: [run_workflows, manage_agents, view_all_projects]
    developer:
      permissions: [create_specs, run_workflows, view_own_projects]
    viewer:
      permissions: [view_own_projects, view_dashboards, view_artifacts]
  
  authentication:
    method: github_oauth        # github_oauth | api_token
    require_org_membership: true
```

---

## 14) Web Dashboard

### 14.1 Dashboard Views

**Portfolio View** — all projects at a glance (see §7.3)

**Project View:**
- Active runs with phase progress
- Issue queue with agent assignments
- Agent configuration and status
- Recent activity feed
- Artifact browser for all runs

**Run View:**
- Phase-by-phase progress with timing
- Task-level detail (which issue, which agent, status)
- Live agent output streaming (from OpenHands)
- Recovery event timeline
- **Artifact browser** (see §11.3) — inline viewing of all run artifacts

**Spec View:**
- Spec content with syntax highlighting
- Gate validation results
- Adversarial review findings
- Traceability matrix
- Maturity progress bar
- "Edit in Conversation" button → opens conversational UI

**Artifact View:**
- Full artifact tree browser (see §11.3)
- Inline viewers for all artifact types (JSON, Markdown, diff, HTML, SARIF, JSONL)
- Download individual files or entire run as ZIP
- Compare artifacts between runs (diff view)
- Search artifacts by content, type, or date

**Agent View:**
- All configured agents with status
- Execution history
- Enable/disable toggle
- Configuration editor

**Workflow View:**
- Visual pipeline editor (see §6.4)
- Workflow YAML editor with validation
- Gate configuration
- Adversarial reviewer configuration

**Template View:**
- Browse all templates (built-in + custom)
- Preview template content
- Create new spec from template
- Create/edit custom templates

### 14.2 Tech Stack

```yaml
dashboard:
  frontend: React + TypeScript + Tailwind
  state: React Query (server state) + Zustand (client state)
  charts: Recharts
  real_time: WebSocket (run progress, agent output streaming)
  artifact_viewers:
    markdown: react-markdown with remark-gfm
    json: react-json-view
    diff: react-diff-viewer
    logs: custom log viewer with virtual scrolling
    html: sandboxed iframe
    sarif: custom findings renderer
  
  backend: Node.js + Express
  database: SQLite (local mode)
  
  openhands_integration:
    method: REST API + WebSocket
    features: [sandbox_status, agent_output_streaming, run_control]
```

---

## 15) Deployment

### 15.1 Local Mode (v2 Default)

For individual developers or small teams running on their own machine.

```bash
# Install
npm install -g specmas

# Initialize in a repo
cd my-project
specmas init

# Set up OpenHands (pulls Docker images)
specmas setup openhands

# Start dashboard (runs OpenHands locally via Docker)
specmas dashboard start

# Run a workflow
specmas run specs/my-feature.md
```

**Requirements:**
- Docker (for OpenHands sandboxes)
- Node.js 20+
- API keys for at least one LLM provider
- GitHub token with `repo` scope
- 16GB+ RAM recommended (8GB minimum)
- SSD storage (for Docker image caching)

### 15.2 Team Server Mode (Local Infrastructure)

For teams running a shared Spec-MAS server on team-managed infrastructure (not cloud-hosted by OpenHands).

```bash
# Deploy server on team machine/VM
docker-compose up -d
```

**Components:**
- Spec-MAS API Server
- OpenHands Runtime (local Docker daemon with sandbox pool)
- Dashboard (React app)
- SQLite (local) or PostgreSQL (team server)

### 15.3 Future: Cloud-Hosted OpenHands

Remote/cloud-hosted OpenHands (OpenHands-managed infrastructure, Kubernetes sandbox pools, multi-region execution) is planned for a future release. v2 is local Docker only.

### 15.4 Configuration Matrix

| Feature | Local Mode | Team Server | Future: Cloud |
|---------|-----------|-------------|---------------|
| Projects | 1-5 | Unlimited | Unlimited |
| Concurrent runs | 1-3 | Configurable | Auto-scaling |
| Database | SQLite | PostgreSQL | Managed DB |
| Auth | API token | GitHub OAuth | SSO |
| OpenHands | Local Docker | Local Docker (shared) | Cloud-hosted |
| Dashboard | localhost:3000 | Hosted URL | Hosted URL |
| Multi-user | No | Yes | Yes |

---

## 16) Data Model

### 16.1 Core Entities

```
Project {
  id, name, repo_url, default_branch, config_yaml,
  created_at, updated_at
}

Spec {
  id, project_id, path, name, complexity, maturity,
  content_sha, content, template_id,
  created_at, updated_at
}

Template {
  id, name, category, complexity, path,
  description, tags, variables_json,
  is_custom, created_at
}

Workflow {
  id, name, description, definition_yaml,
  is_default, created_at, updated_at
}

Run {
  id, project_id, spec_id, workflow_id,
  status (pending|running|completed|failed|paused|cancelled),
  current_phase, started_at, completed_at,
  initiated_by, error_message,
  artifact_path, created_at
}

Phase {
  id, run_id, name, status, agent_id,
  started_at, completed_at,
  error_message
}

Task {
  id, run_id, phase_id, github_issue_number,
  github_issue_url, spec_section, agent_id,
  status, started_at, completed_at,
  retry_count, restart_count,
  branch_name, result_json
}

Agent {
  id, name, provider, type, command,
  config_yaml, enabled, created_at, updated_at
}

AgentExecution {
  id, task_id, agent_id, model,
  duration_seconds, status, error_message,
  started_at, completed_at
}

RecoveryEvent {
  id, task_id, run_id, event_type,
  (branch_discarded|restart|fallback|escalated),
  from_agent_id, to_agent_id,
  failure_count, branch_name,
  created_at
}

Notification {
  id, project_id, event_type, payload_json,
  channels_sent, created_at
}

Artifact {
  id, run_id, phase_id, task_id,
  path, type (json|md|sarif|patch|html|jsonl|xml),
  size_bytes, created_at
}
```

### 16.2 Entity Relationships

```
Project 1──* Spec
Project 1──* Run
Run *──1 Spec
Run *──1 Workflow
Run 1──* Phase
Run 1──* Artifact
Phase 1──* Task
Task *──1 Agent
Task 1──* AgentExecution
Task 1──* RecoveryEvent
Project 1──* Notification
Template 1──* Spec (optional: which template created the spec)
```

---

## 17) Migration from v1

### 17.1 What Carries Over

- **Spec format** — v3 Markdown specs are fully compatible; no changes needed
- **Spec templates** — TEMPLATE-STARTUP.md works as-is; also available as the `custom/legacy-startup` template
- **Validation gates** — G1-G4 logic preserved, now configurable via YAML
- **Adversarial reviewers** — same 5 reviewers, now configurable
- **GitHub Issues pattern** — formalized from v1 concept to enforced requirement

### 17.2 What Changes

| v1 | v2 |
|----|-----|
| LangGraph orchestration | OpenHands orchestration (local Docker) |
| Single project | Multi-project |
| Claude Agent SDK | Claude Code / Codex / Gemini CLI |
| Hardcoded workflow | YAML-configurable workflows |
| Manual spec authoring | Conversational UI + template library + manual |
| Conceptual GitHub Issues | Enforced GitHub Issues work queue |
| No notifications | Slack/email/webhook/GitHub notifications |
| CLI only | CLI + Web Dashboard + Conversational UI |
| No CI/CD integration | GitHub Actions (validate, review, plan, run) |
| No recovery strategy | Git-based rollback + automatic restart |
| No artifact management | Full artifact store with UI + CLI browsing |

### 17.3 Migration Steps

1. **Install specmas v2:** `npm install -g specmas@2`
2. **Initialize project:** `specmas init` (creates v2 config alongside existing files)
3. **Import existing specs:** existing `specs/*.md` files are auto-detected
4. **Configure agents:** create agent YAML files in `agents/`
5. **Set up OpenHands:** `specmas setup openhands` (pulls Docker images locally)
6. **Add GitHub Actions** (optional): copy provided workflow files to `.github/workflows/`
7. **Configure notifications** (optional): add channels to `.specmas/project.yaml`
8. **First run:** `specmas run specs/existing-feature.md` (uses default workflow)

---

## 18) Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)
- [ ] Spec-MAS API Server skeleton (Express + TypeScript)
- [ ] Project management (create, list, status, project.yaml)
- [ ] Spec parsing and validation (port from v1)
- [ ] `specmas` CLI core commands (init, project, spec validate)
- [ ] SQLite storage for local mode
- [ ] Agent adapter framework + Claude Code adapter
- [ ] Template library with 6 initial templates

### Phase 2: OpenHands + Git Recovery (Weeks 5-8)
- [ ] OpenHands local Docker sandbox provisioning and lifecycle
- [ ] Agent execution in sandboxes (Claude Code first)
- [ ] GitHub Issues creation from specs
- [ ] Agent comment protocol implementation
- [ ] Run state management
- [ ] Basic workflow engine (sequential phases)
- [ ] Git branch strategy and commit frequency enforcement
- [ ] Failure detection and automatic branch discard/restart

### Phase 3: Multi-Agent + Workflows + Actions (Weeks 9-12)
- [ ] Codex and Gemini CLI adapters
- [ ] YAML workflow parser and engine
- [ ] Configurable gates and custom gate checks
- [ ] Parallel task execution within phases
- [ ] Agent fallback chains
- [ ] GitHub Actions: validate-spec, adversarial-review, plan, run
- [ ] PR integration (check runs, comments)

### Phase 4: Web UI + Artifacts (Weeks 13-16)
- [ ] Dashboard: portfolio view, project view, run view
- [ ] Agent management UI
- [ ] Workflow editor UI
- [ ] Real-time run progress (WebSocket)
- [ ] Artifact store and retention management
- [ ] Artifact browser (Web UI) with inline viewers for all types
- [ ] Artifact CLI commands (list, show, download, diff, summary)

### Phase 5: Conversational Spec Authoring (Weeks 17-20)
- [ ] Conversational UI framework
- [ ] Guided spec authoring flow
- [ ] Full template library (all 16 templates)
- [ ] Custom template creation/import/export
- [ ] Real-time validation in conversation
- [ ] Edit mode for existing specs
- [ ] Template management in Web UI

### Phase 6: Multi-Project + Notifications + Production (Weeks 21-24)
- [ ] Multi-project parallel execution
- [ ] Project isolation and resource management
- [ ] Notification engine (event bus, rule matcher, channel dispatcher)
- [ ] All notification channels (Slack, email, webhook, GitHub)
- [ ] Notification filtering (quiet hours, rate limits, dedup)
- [ ] Team server mode (PostgreSQL, GitHub OAuth, multi-user)
- [ ] Performance optimization and hardening

---

## 19) Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Spec-to-implementation time (EASY) | < 2 hours | Run duration tracking |
| Spec-to-implementation time (MODERATE) | < 8 hours | Run duration tracking |
| Agent task success rate | > 85% | Task completion tracking |
| Automatic recovery success rate | > 60% of failed tasks recovered | Recovery event tracking |
| Projects running in parallel | ≥ 5 | Dashboard metrics |
| Spec authoring time (conversational) | 50% faster than manual | User tracking |
| Gate validation pass rate (first attempt) | > 70% | Validation tracking |
| Agent fallback usage | < 15% of tasks | Execution tracking |
| Dashboard page load | < 2s | Performance monitoring |
| Notification delivery latency | < 30s from event | Event timestamp tracking |
| Artifact access time (CLI) | < 2s for list/show | CLI timing |

---

## 20) Open Questions

- [ ] Should the conversational UI use the same LLM as the coding agents, or a dedicated instance?
- [ ] How do we handle specs that span multiple repos (cross-project features)?
- [ ] Should there be a marketplace/registry for sharing workflow templates and custom gate checks across teams?
- [ ] Do we need a "playground" mode where users can test agent behavior on sample specs before running real workflows?
- [ ] Should GitHub Actions trigger OpenHands runs directly, or should they communicate via the Spec-MAS API server?
- [ ] How should the system handle specs that reference templates but have been manually diverged — should template updates propagate?

---

## 21) Glossary

- **Agent** — an AI CLI tool (Claude Code, Codex, Gemini CLI) that executes tasks in an OpenHands sandbox
- **Artifact** — any output file produced by a run (reports, logs, patches, test results), stored and browsable via UI/CLI
- **Gate** — a validation checkpoint that specs must pass before proceeding to the next workflow phase
- **OpenHands** — open-source AI development platform providing sandboxed execution environments (local Docker in v2)
- **Phase** — a stage in a workflow pipeline (validate, plan, implement, test, review)
- **Project** — a GitHub repo registered with Spec-MAS for managed development, with its own configuration
- **Recovery** — automatic detection of repeated failures, branch discard, and clean restart
- **Run** — a single execution of a workflow against a spec within a project
- **Sandbox** — an isolated Docker container on the local host where an agent executes work
- **Spec** — a Markdown specification document following the v3 format
- **Task** — a unit of work represented as a GitHub Issue, assigned to an agent
- **Template** — a pre-built spec starting point with placeholder variables and inline guidance
- **Workflow** — a YAML-defined pipeline of phases, gates, and agent assignments

---

**End of Spec-MAS v2 Definition**
