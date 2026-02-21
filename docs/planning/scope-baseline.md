# Scope Baseline

## Overview
Spec-MAS v2 delivers a local-first orchestration platform for specification-driven execution using OpenHands runtime, multiple coding agents, GitHub issues orchestration, and artifact-first validation.

## In Scope
- Local runtime orchestration and lifecycle control.
- Multi-agent adapter abstraction and deterministic routing.
- Workflow/gate execution with deterministic outputs.
- GitHub issue integration for task decomposition and state transitions.
- CLI + API + dashboard surfaces for operations and visibility.
- Artifact contracts, retention, and renderers.
- Release gates, validation suites, and deployment profiles.

## Out of Scope
- Cloud-hosted OpenHands control plane.
- Agent spend optimization and historical performance routing.
- Marketplace integrations not listed in `features/` specs.

## Non-Goal Guardrails
- No nondeterministic hidden defaults in workflow execution.
- No cross-project data leakage.
- No implicit gate bypass without explicit config.

## Non-Goal Checks
- [ ] Any proposed workflow default is explicit and documented.
- [ ] Any cross-project operation enforces project-scoped data boundaries.
- [ ] Any gate override is opt-in, auditable, and config-driven.
