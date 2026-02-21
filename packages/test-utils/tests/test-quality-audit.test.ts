import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  auditRepositoryTestQuality,
  formatTestQualityAuditFailure
} from '../src/testQualityAudit.js';

const tempDirs: string[] = [];

async function createWorkspaceFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), 'specmas-test-quality-'));
  tempDirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = join(rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, 'utf8');
  }

  return rootDir;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('test-quality audit', () => {
  it('passes repository anti-lazy rules with deterministic thresholds', async () => {
    const repositoryRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
    const result = await auditRepositoryTestQuality({
      rootDir: repositoryRoot,
      minNegativePathRatio: 0.2
    });

    expect(result.ok, formatTestQualityAuditFailure(result)).toBe(true);
    expect(result.filesScanned).toBeGreaterThan(0);
    expect(result.testCaseCount).toBeGreaterThan(0);
    expect(result.negativePathRatio).toBeGreaterThanOrEqual(0.2);
  });

  it('flags focused and skipped tests plus duplicate and empty test bodies', async () => {
    const onlySuffix = ['o', 'n', 'l', 'y'].join('');
    const skipSuffix = ['s', 'k', 'i', 'p'].join('');
    const focusedAlias = ['f', 'i', 't'].join('');
    const testToken = ['i', 't'].join('');
    const duplicateTitle = ['duplicate', 'title'].join(' ');
    const emptyBody = ['()', '=>', '{', '}'].join(' ');
    const fixtureSource = [
      `import { describe, expect, ${testToken} } from 'vitest';`,
      '',
      `describe.${onlySuffix}('quality-fixture', () => {`,
      `  ${testToken}('${duplicateTitle}', ${emptyBody});`,
      `  ${testToken}('${duplicateTitle}', () => {`,
      '    expect(true).toBe(true);',
      '  });',
      `  ${testToken}.${skipSuffix}('skipped title', () => {`,
      '    expect(true).toBe(true);',
      '  });',
      `  ${focusedAlias}('focused title', () => {`,
      '    expect(true).toBe(true);',
      '  });',
      '});',
      ''
    ].join('\n');

    const workspace = await createWorkspaceFixture({
      'apps/api/tests/audit-fixture.test.ts': fixtureSource
    });

    const result = await auditRepositoryTestQuality({
      rootDir: workspace,
      minNegativePathRatio: 0
    });
    const formatted = formatTestQualityAuditFailure(result);

    expect(result.ok).toBe(false);
    const ruleIds = result.violations.map((violation) => violation.ruleId);
    expect(ruleIds.filter((ruleId) => ruleId === 'focused-or-skipped')).toHaveLength(3);
    expect(ruleIds).toContain('duplicate-title');
    expect(ruleIds).toContain('empty-test-body');
    expect(formatted).toContain('apps/api/tests/audit-fixture.test.ts');
    expect(formatted).toContain('Duplicate test title "duplicate title"');
    expect(formatted).toContain('empty body');
  });

  it('fails when negative-path title coverage is below threshold', async () => {
    const workspace = await createWorkspaceFixture({
      'packages/core/tests/ratio-fixture.test.ts': `import { expect, it } from 'vitest';

it('runs the happy path', () => {
  expect(true).toBe(true);
});

it('returns normalized output', () => {
  expect(true).toBe(true);
});

it('fails with invalid payload', () => {
  expect(true).toBe(true);
});
`
    });

    const result = await auditRepositoryTestQuality({
      rootDir: workspace,
      minNegativePathRatio: 0.6
    });
    const ratioViolation = result.violations.find(
      (violation) => violation.ruleId === 'negative-path-ratio'
    );

    expect(result.ok).toBe(false);
    expect(ratioViolation).toBeDefined();
    expect(ratioViolation?.message).toContain('(1/3)');
    expect(formatTestQualityAuditFailure(result)).toContain('required >= 60.0%');
  });

  it('reports when no matching test files are discovered', async () => {
    const workspace = await createWorkspaceFixture({
      'docs/readme.md': '# no tests'
    });
    const result = await auditRepositoryTestQuality({
      rootDir: workspace,
      minNegativePathRatio: 0
    });

    expect(result.ok).toBe(false);
    expect(result.filesScanned).toBe(0);
    expect(result.testCaseCount).toBe(0);
    expect(result.violations[0]?.ruleId).toBe('no-test-files');
    expect(formatTestQualityAuditFailure(result)).toContain(
      'No matching test files were discovered'
    );
  });
});
