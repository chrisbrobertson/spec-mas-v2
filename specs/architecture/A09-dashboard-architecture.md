# A09 Dashboard Architecture

## Scope
Defines dashboard view structure, data presentation architecture, and runtime integration with run state and artifacts.

## Normative References
- `../reference-map.md`: `SRC-14`, `SRC-14.3`, `SRC-11`, `SRC-7`, `SRC-9`
- `../features/F11-artifact-management-and-viewers.md`
- `../features/F07-multi-project-operations.md`
- `../validation/V07-validation-tooling-and-artifacts.md`

## Architecture Requirements
- The dashboard shall expose a global project/repository selector that lists all registered projects with project name, repository URL, and default branch.
- The selected project context shall drive all project-level routes (`/projects/:projectId/*`) and persist across reloads until explicitly changed by the user.
- Within a selected project, the UI shall expose a branch selector with at least: default branch, active run branches, integration branch, release branch, and `all branches`.
- Run list and run detail views shall display branch metadata (`source_branch`, `working_branch`, `integration_branch`, `release_branch`) and support filtering by branch.
- Merge state shall be visible per run using deterministic statuses: `awaiting_human_approval`, `approved`, `rejected`, `merged`.
- The UI shall not expose automatic merge controls for agent-generated branches; merge transitions require explicit human approval actions routed through API authorization.
- dashboard run state shall be sourced from persisted API read models and must not depend on static fixture run IDs or hardcoded payloads.
- Run detail, logs, and artifact views shall consume persistent run data endpoints and support cursor-safe log stream refresh behavior.

## Acceptance Focus
- Users can select a project/repo and immediately see only runs/issues/artifacts for that project.
- Users can select a branch and immediately see only runs tied to that branch context.
- Every run visible in the UI has dedicated branch metadata and human-approval merge state.
- real-runtime e2e coverage shall validate dynamic run IDs, run status progression, log visibility, and artifact visibility through live API-backed dashboard routes.
