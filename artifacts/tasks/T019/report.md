# T019 Report

## Scope
- Bootstrap CLI root and command groups: `project`, `run`, `agent`, `artifact`, `issues`.

## Implemented
- `apps/cli/src/cli.ts`: root CLI and command group skeleton.
- `apps/cli/src/index.ts`: async runner and exports.
- `apps/cli/tests/cli.test.ts`: command-group baseline test.

## Verification
- Command: `pnpm --filter @specmas/cli test:unit`
- Output:
  - `zsh:1: command not found: pnpm`
- Blocker:
  - `pnpm` missing and Corepack cannot fetch `pnpm@9.15.0` (`ENOTFOUND registry.npmjs.org`).
