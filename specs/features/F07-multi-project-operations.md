# F07 Multi-Project Operations

## Scope
Feature behavior for project isolation, shared oversight, and parallel execution across multiple repositories.

## Normative References
- `../reference-map.md`: `SRC-7`, `SRC-14`, `SRC-9`
- `../architecture/A01-system-layers.md`
- `../architecture/A09-dashboard-architecture.md`

## Functional Requirements
- The system shall treat each registered project as `{project_id, repo_url, default_branch}` with independent run state, issue state, and artifact storage.
- Users shall be able to switch dashboard context between projects without cross-project data leakage.
- For each selected project, the system shall expose repository branches relevant to automation: default branch, per-run task branches, integration branch, and release branch.
- Every run shall execute in dedicated run/task branches under deterministic naming rules (for example `specmas/run-<runId>/issue-<issueNumber>`).
- Completed task branches may be merged only after explicit human approval; agent-only auto-merge into integration/release/main is disallowed.

## Acceptance Focus
- Projects remain isolated by config and runtime resources.
- Operators can view aggregate status without violating isolation boundaries.
- Branch context is first-class in run visibility and operational controls.
- Merge progression remains blocked until human approval status is `approved`.
