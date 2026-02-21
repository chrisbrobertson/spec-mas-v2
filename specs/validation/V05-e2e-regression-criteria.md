# V05 E2E Regression Criteria

## Scope
Defines deterministic end-to-end and regression criteria for critical workflows.

## Normative References
- `../reference-map.md`: `SRC-6`, `SRC-9`, `SRC-11`
- `../features/F01-openhands-orchestration-runtime.md`
- `../features/F09-rollback-and-recovery.md`

## Validation Focus
- Critical business paths are reproducible from clean environments.
- Regressions are detectable through stable scenario baselines.
- real-runtime e2e scenarios must start live runs, assert dynamic run IDs, and verify run-state progression without fixture-coupled assumptions.
- Dashboard regression checks must include run list/detail, artifact visibility, and log-stream visibility for live API-backed runs.
