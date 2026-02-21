# T031 Task Report

## Summary
- Expanded runtime adapter contract with provision/execute/stream/teardown semantics and tests.

## Verification
- Command: `pnpm --filter @specmas/runtime test:unit -- adapter-contract`
- Result: BLOCKED
- Output:
```text
zsh:1: command not found: pnpm
```

## Notes
- Attempted bootstrap: COREPACK_HOME=/tmp/corepack-home corepack prepare pnpm@9.15.0 --activate. Blocked by restricted network request to registry.npmjs.org.
