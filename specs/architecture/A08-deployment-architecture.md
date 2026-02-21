# A08 Deployment Architecture

## Scope
Defines local default mode, team server mode on local infrastructure, and explicit future cloud direction.

## Normative References
- `../reference-map.md`: `SRC-15`, `SRC-15.4`, `SRC-2.2`
- `./A03-openhands-runtime-lifecycle.md`
- `./A09-dashboard-architecture.md`

## Notes
- Operational runbooks can extend this file but should not duplicate mode definitions.
- Normative deployment rule for v2: run Spec-MAS app components (API, dashboard, orchestration worker) as local npm processes.
- Use Docker containers only for third-party dependencies and execution backends (for example OpenHands sandboxes, PostgreSQL, Mailhog, sqlite-web).
- Startup workflows must expose OpenHands runtime readiness signals before user-triggered execution, including a routable readiness probe and run-start rejection when prerequisites are not satisfied.
