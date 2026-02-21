import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { findMissingMigrations, resolveSqliteDatabasePath, runDatabasePreflight } from '../src/dbPreflight.js';

async function createRepoFixture(): Promise<{ repoRoot: string; sqlitePath: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'specmas-db-preflight-'));
  await mkdir(join(repoRoot, 'prisma', 'migrations', '0001_init'), { recursive: true });
  await writeFile(join(repoRoot, 'prisma', 'schema.prisma'), 'datasource db { provider = "sqlite"; url = env("DATABASE_URL") }');
  await writeFile(join(repoRoot, 'prisma', 'migrations', 'migration_lock.toml'), 'provider = "sqlite"');
  await writeFile(join(repoRoot, 'prisma', 'migrations', '0001_init', 'migration.sql'), '-- init');
  const sqlitePath = join(repoRoot, 'prisma', 'specmas.db');
  await writeFile(sqlitePath, '');
  return { repoRoot, sqlitePath };
}

describe('db-preflight', () => {
  it('passes on happy path when required files and migrations are present', async () => {
    const fixture = await createRepoFixture();

    await expect(
      runDatabasePreflight({
        repoRoot: fixture.repoRoot,
        databaseUrl: 'file:./specmas.db',
        loadAppliedMigrationNames: async () => ['0001_init']
      })
    ).resolves.toBeUndefined();
  });

  it('fails for missing database url in failure path', async () => {
    const fixture = await createRepoFixture();

    await expect(
      runDatabasePreflight({
        repoRoot: fixture.repoRoot,
        databaseUrl: undefined,
        loadAppliedMigrationNames: async () => ['0001_init']
      })
    ).rejects.toThrow('DATABASE_URL is required');
  });

  it('fails when migrations are missing in edge path', async () => {
    const fixture = await createRepoFixture();

    await expect(
      runDatabasePreflight({
        repoRoot: fixture.repoRoot,
        databaseUrl: 'file:./specmas.db',
        loadAppliedMigrationNames: async () => []
      })
    ).rejects.toThrow('unapplied migrations detected (0001_init)');
  });

  it('resolves sqlite paths and migration diffs deterministically', () => {
    const repoRoot = '/repo';
    expect(resolveSqliteDatabasePath('file:./specmas.db', repoRoot)).toBe('/repo/prisma/specmas.db');
    expect(resolveSqliteDatabasePath('file:/absolute/path.db', repoRoot)).toBe('/absolute/path.db');
    expect(resolveSqliteDatabasePath('file::memory:', repoRoot)).toBeUndefined();
    expect(findMissingMigrations(['0001_init', '0002_next'], ['0001_init'])).toEqual(['0002_next']);
  });
});
