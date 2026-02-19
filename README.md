# Spec-MAS v2

Spec-MAS v2 is a specification-first multi-agent orchestration design centered on local OpenHands execution, GitHub Issues as the work queue, and artifact-driven validation.

## Repository Layout
- `specs/spec-mas-v2-definition.md`: Canonical end-to-end v2 definition.
- `specs/reference-map.md`: Shared source reference IDs (`SRC-*`) used by split specs.
- `specs/features/`: Individual feature specs.
- `specs/architecture/`: Individual architecture specs.
- `specs/validation/`: Individual testing and validation specs.

## How To Read
1. Start with `specs/spec-mas-v2-definition.md` for full context.
2. Use `specs/reference-map.md` for canonical section mapping.
3. Use split specs in `specs/features/`, `specs/architecture/`, and `specs/validation/` for focused work.

## Authoring Rule (DRY)
- Keep canonical requirement text in `specs/spec-mas-v2-definition.md`.
- In split specs, reference `SRC-*` IDs and cross-link related spec files instead of duplicating requirement blocks.
