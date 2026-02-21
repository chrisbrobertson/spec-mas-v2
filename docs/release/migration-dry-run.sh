#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for migration dry-run" >&2
  exit 1
fi

echo "Running Prisma migration dry-run against: ${DATABASE_URL}"
corepack pnpm prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script >/tmp/specmas-migration-dry-run.sql

echo "Dry-run SQL written to /tmp/specmas-migration-dry-run.sql"
