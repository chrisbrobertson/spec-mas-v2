# T037 Task Report

## Summary
- Finalized role-aware adapter contract with credential hooks and connectivity probe interfaces.

## Verification
- Command: `pnpm --filter @specmas/adapters test:unit -- contract`
- Result: BLOCKED
- Output:
```text
zsh:1: command not found: pnpm
```

## Notes
- Attempted bootstrap: COREPACK_HOME=/tmp/corepack-home corepack prepare pnpm@9.15.0 --activate. Blocked by restricted network request to registry.npmjs.org.
