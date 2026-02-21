# T021 Report

## Scope
- Implement `run` CLI skeleton commands: `start`, `status`, `cancel` with required-arg validation.

## Implemented
- `apps/cli/src/services.ts`: deterministic in-memory run service.
- `apps/cli/src/cli.ts`: `run` command handlers and output formatting.
- `apps/cli/tests/run-command.test.ts`: happy/failure/edge coverage.

## Verification
- Command: `pnpm --filter @specmas/cli test:unit -- run-command`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` unavailable; Corepack cannot resolve registry (offline sandbox).
