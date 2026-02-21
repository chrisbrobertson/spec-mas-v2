# F01 OpenHands Orchestration Runtime

## Scope
Feature behavior for running workflow phases in local OpenHands sandboxes with artifact capture and run-state visibility.

## Normative References
- `../reference-map.md`: `SRC-2.2`, `SRC-2.3`, `SRC-2.4`, `SRC-2.5`
- `../architecture/A03-openhands-runtime-lifecycle.md`
- `../validation/V07-validation-tooling-and-artifacts.md`

## Acceptance Focus
- Every phase executes through the defined sandbox lifecycle.
- Run outcomes and artifacts are observable through CLI and dashboard surfaces.

## Runtime Integration Contract
- API run control is the only allowed mutation path for runtime orchestration: `POST /runs` to start and `POST /runs/:runId/cancel` to cancel.
- Runtime reads must be backed by persistent run data from storage, not fixture IDs/content (`/runs`, `/runs/:runId`, `/runs/:runId/artifacts`, `/runs/:runId/logs`, `/runs/:runId/logs/stream`).
- OpenHands runtime readiness must be checked before starting a run and surfaced through deterministic diagnostics.
