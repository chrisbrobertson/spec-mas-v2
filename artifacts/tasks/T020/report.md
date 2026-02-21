# T020 Report

## Scope
- Implement `project` CLI commands: `list`, `show`, `create`, `remove` with table/JSON output.

## Implemented
- `apps/cli/src/services.ts`: deterministic in-memory project service.
- `apps/cli/src/cli.ts`: `project` command handlers and output formatting.
- `apps/cli/tests/project-command.test.ts`: happy/failure/edge coverage.

## Verification
- Command: `pnpm --filter @specmas/cli test:unit -- project-command`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - Environment has no `pnpm`; Corepack download blocked by network restrictions.
