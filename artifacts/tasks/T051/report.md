# T051 Report

## Scope
- Implement CLI artifact commands: `list`, `show`, `download`, `diff`, `open`, `clean`.

## Implemented
- `apps/cli/src/services.ts`: deterministic in-memory artifact service.
- `apps/cli/src/cli.ts`: artifact command handlers and validations.
- `apps/cli/tests/artifact-command.test.ts`: happy/failure/edge command coverage.

## Verification
- Command: `pnpm --filter @specmas/cli test:unit -- artifact-command`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` missing; Corepack cannot download package manager due no DNS/network access.
