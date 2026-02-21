# T027 Task Report

## Summary
- Added CI coverage-threshold enforcement in .github/workflows/ci.yml.

## Verification
- Command: `pnpm test:unit`
- Result: BLOCKED
- Output:
```text
zsh:1: command not found: pnpm
```

## Notes
- Attempted bootstrap: COREPACK_HOME=/tmp/corepack-home corepack prepare pnpm@9.15.0 --activate. Blocked by restricted network request to registry.npmjs.org.
