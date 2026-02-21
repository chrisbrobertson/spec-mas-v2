import { access, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PRISMA_ROOT = 'prisma';
const REQUIRED_PATHS = ['schema.prisma', 'migrations/migration_lock.toml', 'migrations/0001_init/migration.sql'];

async function ensureRequiredFiles(repoRoot: string): Promise<void> {
  for (const relativePath of REQUIRED_PATHS) {
    await access(resolve(repoRoot, PRISMA_ROOT, relativePath));
  }
}

async function listLocalMigrations(repoRoot: string): Promise<string[]> {
  const entries = await readdir(resolve(repoRoot, PRISMA_ROOT, 'migrations'), {
    withFileTypes: true
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function loadAppliedMigrations(): Promise<string[]> {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
      'SELECT migration_name FROM _prisma_migrations ORDER BY migration_name'
    );
    return rows.map((row) => row.migration_name);
  } finally {
    await prisma.$disconnect();
  }
}

export function findMissingMigrations(localMigrations: string[], appliedMigrations: string[]): string[] {
  const appliedSet = new Set(appliedMigrations);
  return localMigrations.filter((name) => !appliedSet.has(name));
}

export function resolveSqliteDatabasePath(databaseUrl: string, repoRoot: string): string | undefined {
  if (!databaseUrl.startsWith('file:')) {
    return undefined;
  }

  const rawPath = databaseUrl.slice('file:'.length).split('?')[0];
  if (!rawPath || rawPath === ':memory:') {
    return undefined;
  }

  if (rawPath.startsWith('/')) {
    return rawPath;
  }

  return resolve(repoRoot, PRISMA_ROOT, rawPath);
}

export interface DatabasePreflightOptions {
  repoRoot?: string;
  databaseUrl?: string;
  loadAppliedMigrationNames?: () => Promise<string[]>;
}

export async function runDatabasePreflight(options: DatabasePreflightOptions = {}): Promise<void> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Database preflight failed: DATABASE_URL is required. Run `corepack pnpm db:bootstrap` before starting the API.'
    );
  }

  try {
    await ensureRequiredFiles(repoRoot);
  } catch {
    throw new Error('Database preflight failed: required Prisma schema/migration files are missing.');
  }

  const sqlitePath = resolveSqliteDatabasePath(databaseUrl, repoRoot);
  if (sqlitePath) {
    try {
      await access(sqlitePath);
    } catch {
      throw new Error(
        `Database preflight failed: SQLite file not found at ${sqlitePath}. Run \`corepack pnpm db:bootstrap\`.`
      );
    }
  }

  const [localMigrations, appliedMigrations] = await Promise.all([
    listLocalMigrations(repoRoot),
    (options.loadAppliedMigrationNames ?? loadAppliedMigrations)()
  ]);

  const missing = findMissingMigrations(localMigrations, appliedMigrations);
  if (missing.length > 0) {
    throw new Error(
      `Database preflight failed: unapplied migrations detected (${missing.join(', ')}). Run \`corepack pnpm db:bootstrap\`.`
    );
  }
}
