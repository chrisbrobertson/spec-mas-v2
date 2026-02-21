# T023 Report

## Summary
Implemented spec parser and YAML front-matter validator in `packages/core`.

## Implementation
- Reworked `packages/core/src/specParser.ts` to:
  - parse YAML front matter using `yaml`
  - validate required fields via Zod (`specmas`, `kind`, `id`, `name`, `version`, `complexity`, `maturity`)
  - extract markdown sections and enforce required sections (`Overview`, `Functional Requirements`, `Acceptance Criteria`)
  - expose focused helpers for front-matter and section parsing/validation

## Tests
- Updated `packages/core/tests/spec-parser.test.ts` with:
  - happy path parsing coverage
  - failure coverage (missing block, invalid YAML, missing fields, missing sections, invalid values)
  - edge coverage (UTF-8 BOM and CRLF handling)

## Verification
- Required: `pnpm --filter @specmas/core test:unit -- spec-parser`
- Result: blocked in this environment (`pnpm: command not found`, exit 127).
