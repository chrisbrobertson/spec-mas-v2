import { describe, expect, it } from 'vitest';
import { InMemoryArtifactService } from '../src/services.js';
import { runCliCommand } from './test-utils.js';

function createArtifactService() {
  return new InMemoryArtifactService([
    {
      runId: 'run-0001',
      projectId: 'alpha',
      ageDays: 10,
      files: {
        'run-summary.md': '# Run 1 Summary',
        'validation/gate-results.json': '{"G1":"PASS"}'
      }
    },
    {
      runId: 'run-0002',
      projectId: 'alpha',
      ageDays: 45,
      files: {
        'run-summary.md': '# Run 2 Summary',
        'validation/gate-results.json': '{"G1":"FAIL"}'
      }
    }
  ]);
}

describe('artifact-command', () => {
  it('supports list/show/download/diff/open/clean flows', async () => {
    const artifactService = createArtifactService();

    const list = await runCliCommand(['artifact', 'list', 'run-0001', '--format', 'json'], { artifactService });
    expect(list.error).toBeUndefined();
    expect(JSON.parse(list.io.output[0])).toEqual(['run-summary.md', 'validation/gate-results.json']);

    const show = await runCliCommand(['artifact', 'show', 'run-0001', 'run-summary.md'], { artifactService });
    expect(show.error).toBeUndefined();
    expect(show.io.output[0]).toBe('# Run 1 Summary');

    const downloadAll = await runCliCommand(
      ['artifact', 'download', 'run-0001', '--all', '--output', './export', '--format', 'json'],
      { artifactService }
    );
    expect(downloadAll.error).toBeUndefined();
    expect(JSON.parse(downloadAll.io.output[0])).toEqual({
      outputDir: './export',
      files: ['run-summary.md', 'validation/gate-results.json']
    });

    const diff = await runCliCommand(
      ['artifact', 'diff', 'run-0001', 'run-0002', '--artifact', 'validation/gate-results.json'],
      { artifactService }
    );
    expect(diff.error).toBeUndefined();
    expect(diff.io.output[0]).toContain('--- run-0001/validation/gate-results.json');
    expect(diff.io.output[0]).toContain('+++ run-0002/validation/gate-results.json');

    const open = await runCliCommand(['artifact', 'open', 'run-0001', 'run-summary.md'], { artifactService });
    expect(open.error).toBeUndefined();
    expect(open.io.output[0]).toBe('http://localhost:3000/artifacts/run-0001/run-summary.md');

    const clean = await runCliCommand(
      ['artifact', 'clean', '--project', 'alpha', '--older-than', '30', '--format', 'json'],
      { artifactService }
    );
    expect(clean.error).toBeUndefined();
    expect(JSON.parse(clean.io.output[0])).toEqual({ removedRuns: ['run-0002'] });
  });

  it('fails for unknown runs or artifact paths', async () => {
    const artifactService = createArtifactService();

    const missingRun = await runCliCommand(['artifact', 'list', 'run-missing'], { artifactService });
    expect(missingRun.error?.message).toBe('Run not found: run-missing');

    const missingArtifact = await runCliCommand(['artifact', 'show', 'run-0001', 'missing.txt'], {
      artifactService
    });
    expect(missingArtifact.error?.message).toBe('Artifact not found: run-0001/missing.txt');
  });

  it('validates download and cleanup edge conditions', async () => {
    const artifactService = createArtifactService();

    const missingPath = await runCliCommand(['artifact', 'download', 'run-0001', '--output', './export'], {
      artifactService
    });
    expect(missingPath.error?.message).toBe('artifactPath is required unless --all is provided');

    const invalidOlderThan = await runCliCommand(['artifact', 'clean', '--older-than', '-1'], {
      artifactService
    });
    expect(invalidOlderThan.error?.message).toBe('--older-than must be a non-negative integer');

    const noRemovals = await runCliCommand(
      ['artifact', 'clean', '--project', 'alpha', '--older-than', '90', '--format', 'json'],
      { artifactService }
    );
    expect(noRemovals.error).toBeUndefined();
    expect(JSON.parse(noRemovals.io.output[0])).toEqual({ removedRuns: [] });
  });
});
