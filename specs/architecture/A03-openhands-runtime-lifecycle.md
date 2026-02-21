# A03 OpenHands Runtime Lifecycle

## Scope
Defines OpenHands runtime constraints, sandbox configuration, and lifecycle (provision, execute, capture, teardown).

## Normative References
- `../reference-map.md`: `SRC-2.1`, `SRC-2.2`, `SRC-2.3`, `SRC-2.4`, `SRC-2.5`
- `./A07-security-architecture.md`
- `../validation/V07-validation-tooling-and-artifacts.md`

## Notes
- v2 is local Docker only; cloud-hosted runtime is explicitly deferred.
- This Docker scope applies to OpenHands runtime/sandboxes; Spec-MAS services themselves run locally via npm/Node.js processes.

## Architecture Requirements
- OpenHands runtime readiness must be evaluated before run start, including Docker daemon availability, runtime bootstrap profile validation, and required image checks.
- Runtime lifecycle transitions must flow through API run control endpoints and persist run/phase/task state for downstream UI/CLI read models.
- Runtime capture outputs must be persisted as artifacts and log events so stream replay and artifact discovery remain deterministic across restarts.
