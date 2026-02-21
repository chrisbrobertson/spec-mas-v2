# Secrets and Credential Injection

## Overview
This document defines deterministic secret-reference patterns for runtime and adapter execution.

## Prerequisites
- Secret values supplied via environment variables in execution contexts.
- No plaintext secrets committed to repository files.

## Steps
1. Reference secrets by environment-variable name (for example `OPENAI_API_KEY`).
2. Validate required secret names before adapter execution-plan construction.
3. Redact secret keys in logs/reports (`redactedEnvKeys`).
4. Fail fast when required secret names are missing.

## Verification
- `pnpm --filter @specmas/adapters test:unit`
- `pnpm --filter @specmas/runtime test:unit`
- `test -f docs/security/secrets.md`

## Troubleshooting
- Missing secret errors indicate credentials were not injected in runner environment.
- If secrets leak in logs, ensure reporter paths only include redacted key names.
