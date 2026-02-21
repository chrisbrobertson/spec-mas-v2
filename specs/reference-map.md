# Spec-MAS v2 Reference Map

This map is the single source for canonical section references.
All split specs should cite `SRC-*` IDs from this file instead of repeating the same context.

## Canonical Source
- `spec-mas-v2-definition.md`

## Source IDs

| ID | Canonical Section | Primary Link |
| --- | --- | --- |
| `SRC-0` | Goals and non-goals | `spec-mas-v2-definition.md#0-goals--non-goals` |
| `SRC-1.1` | System layers | `spec-mas-v2-definition.md#11-system-layers` |
| `SRC-1.2` | Core technology decisions | `spec-mas-v2-definition.md#12-core-technology-decisions` |
| `SRC-2.1` | Why OpenHands | `spec-mas-v2-definition.md#21-why-openhands` |
| `SRC-2.2` | Local deployment model (Spec-MAS local npm + Dockerized third-party runtime) | `spec-mas-v2-definition.md#22-deployment-model-local-docker-only-v2` |
| `SRC-2.3` | OpenHands orchestration core | `spec-mas-v2-definition.md#23-openhands-as-orchestration-core` |
| `SRC-2.4` | OpenHands runtime configuration | `spec-mas-v2-definition.md#24-openhands-runtime-configuration` |
| `SRC-2.5` | Sandbox lifecycle | `spec-mas-v2-definition.md#25-sandbox-lifecycle` |
| `SRC-3.1` | Agent adapter architecture | `spec-mas-v2-definition.md#31-agent-adapter-architecture` |
| `SRC-3.2` | Agent selection and routing | `spec-mas-v2-definition.md#32-agent-selection-and-routing` |
| `SRC-4.1` | Conversational authoring concept | `spec-mas-v2-definition.md#41-concept` |
| `SRC-4.2` | Conversation flow | `spec-mas-v2-definition.md#42-conversation-flow` |
| `SRC-4.3` | Authoring modes | `spec-mas-v2-definition.md#43-authoring-modes` |
| `SRC-4.4` | Template library | `spec-mas-v2-definition.md#44-spec-template-library` |
| `SRC-4.5` | Validation integration in authoring | `spec-mas-v2-definition.md#45-validation-integration` |
| `SRC-4.6` | Spec output behavior | `spec-mas-v2-definition.md#46-spec-output` |
| `SRC-4.7` | Web UI artifact integration | `spec-mas-v2-definition.md#47-artifacts-in-the-web-ui` |
| `SRC-5` | `specmas` CLI package and command reference | `spec-mas-v2-definition.md#5-npm-cli-specmas` |
| `SRC-6` | Configurable workflows and gates | `spec-mas-v2-definition.md#6-configurable-workflows-and-gates` |
| `SRC-7` | Multi-project parallel execution | `spec-mas-v2-definition.md#7-multi-project-parallel-execution` |
| `SRC-8` | GitHub Issues as work queue | `spec-mas-v2-definition.md#8-github-issues-as-work-queue` |
| `SRC-9` | Rollback and recovery | `spec-mas-v2-definition.md#9-rollback--recovery` |
| `SRC-10` | Notifications and webhooks | `spec-mas-v2-definition.md#10-notifications-and-webhooks` |
| `SRC-11` | Artifact management | `spec-mas-v2-definition.md#11-artifact-management` |
| `SRC-12` | GitHub Actions integration | `spec-mas-v2-definition.md#12-github-actions-integration` |
| `SRC-13` | Security | `spec-mas-v2-definition.md#13-security` |
| `SRC-14` | Web dashboard | `spec-mas-v2-definition.md#14-web-dashboard` |
| `SRC-14.3` | Dashboard run state and runtime integration contract | `spec-mas-v2-definition.md#143-dashboard-runtime-integration-contract` |
| `SRC-15` | Deployment | `spec-mas-v2-definition.md#15-deployment` |
| `SRC-15.4` | OpenHands runtime readiness startup model | `spec-mas-v2-definition.md#154-runtime-readiness-startup-model` |
| `SRC-16` | Data model | `spec-mas-v2-definition.md#16-data-model` |
| `SRC-17` | Migration from v1 | `spec-mas-v2-definition.md#17-migration-from-v1` |
| `SRC-18` | Implementation roadmap | `spec-mas-v2-definition.md#18-implementation-roadmap` |
| `SRC-19` | Success metrics | `spec-mas-v2-definition.md#19-success-metrics` |
| `SRC-20` | Open questions and glossary | `spec-mas-v2-definition.md#20-open-questions` |

## Usage Rules
- Do not duplicate large requirement text from `spec-mas-v2-definition.md`.
- Split specs should contain only owned scope and references to `SRC-*` IDs.
- Cross-spec links should point to files in `features/`, `architecture/`, and `validation/` for related detail.
