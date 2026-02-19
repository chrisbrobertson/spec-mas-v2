# Repository Agent Policy (Codex)

This file is the repository-level Codex configuration for all work in this repo.
It applies to all subdirectories unless a deeper `AGENTS.md` file overrides specific rules.

## 1) Model Default for New Agent Runs
- Default model for all new code-generation agent runs is `codex-5.3`.
- Every new run must explicitly use `codex-5.3` unless the user explicitly overrides the model in that request.
- Do not mix model families inside the same implementation task unless the user asks for it.

## 2) Mandatory Unit-Test Quality Gate
- All generated or modified production code must include complete unit tests for changed behavior.
- Unit tests must include:
  - happy path coverage
  - failure/error path coverage
  - edge/boundary coverage
- Unit tests must be valid and deterministic:
  - no skipped tests (`skip`, `xit`, `describe.skip`)
  - no focused tests (`only`, `fit`, `fdescribe`)
  - no reliance on network or external mutable state
  - assertions must verify behavior, not only implementation internals
- Code is not accepted as complete until unit tests pass for:
  - changed package/module unit tests
  - full unit suite for the repository (or full workspace suite when available)

## 3) Commit-at-Each-Step Rule
- Each completed implementation step must be committed immediately after its unit-test gate passes.
- Commit granularity: one logical step per commit.
- Commit message format:
  - `type(scope): concise step summary`
- Required commit message body items:
  - what changed
  - why the step was needed
  - unit test commands executed

## 4) Integration Testing by Separate Agent
- After component-level implementation steps are complete, spawn a separate integration-testing agent.
- The integration agent must run all integration-level tests across touched components.
- Integration testing results must be written to `artifacts/qa/integration-report.md`.
- If integration tests fail, implementation is not complete.

## 5) Coding and Documentation Standards (Simple + Consistent)

### Coding Standards
- Prefer clear, small, composable functions.
- Keep files focused on one responsibility.
- Use explicit names; avoid single-letter variables except loop indices.
- Add concise comments only where intent is not obvious.
- Keep behavior deterministic; avoid hidden side effects.
- Keep changes backward-compatible unless the task explicitly requires breaking changes.

### Documentation Standards
- Keep user-facing docs concise, task-oriented, and example-driven.
- Use consistent headings: Overview, Prerequisites, Steps, Verification, Troubleshooting.
- Document new commands/options with examples.
- Record behavior changes and migration notes where relevant.

## 6) Parallel Documentation Agent + QA Sync Check
- For code-generation tasks, spawn a separate documentation agent in parallel.
- Docs agent scope includes all impacted user documentation (for example: `README.md`, user guides, command docs, runbooks).
- At each QA run, verify documentation matches implementation:
  - command names/flags
  - behavior and outputs
  - setup/prerequisites
  - troubleshooting guidance
- Documentation parity results must be written to `artifacts/qa/docs-parity-report.md`.
- If docs are not current, the task is not complete.

## Required Completion Checklist
- Code implemented with `codex-5.3` default run policy.
- Unit tests added/updated and passing (changed scope + full unit suite).
- Step-level commit created for each completed step.
- Integration agent run completed and report generated.
- Documentation agent run completed and docs parity report generated.
- QA confirms code, tests, and docs are in sync.
