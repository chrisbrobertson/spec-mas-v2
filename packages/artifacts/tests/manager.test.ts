import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSystemArtifactManager } from '../src/manager.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('artifact manager', () => {
  it('writes, reads, and lists task artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'artifact-manager-'));
    tempDirs.push(root);
    const manager = new FileSystemArtifactManager(root);

    const manifest = await manager.writeArtifact({
      artifactId: 'report-1',
      runId: 'run-1',
      phaseId: 'phase-1',
      taskId: 'task-1',
      kind: 'report',
      content: '# hello',
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    expect(manifest.path).toBe('run-1/phase-1/task-1/report-1.md');
    expect(await manager.readArtifact(manifest.path)).toBe('# hello');
    expect(await manager.listTaskArtifacts('run-1', 'phase-1', 'task-1')).toEqual([
      'run-1/phase-1/task-1/report-1.md'
    ]);
  });

  it('rejects invalid path traversal input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'artifact-manager-'));
    tempDirs.push(root);
    const manager = new FileSystemArtifactManager(root);

    await expect(
      manager.writeArtifact({
        artifactId: 'log-1',
        runId: 'run-1',
        phaseId: 'phase-1',
        taskId: '../task-1',
        kind: 'log',
        content: 'hello'
      })
    ).rejects.toThrow('taskId contains unsupported path characters');
  });

  it('rejects invalid artifact read path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'artifact-manager-'));
    tempDirs.push(root);
    const manager = new FileSystemArtifactManager(root);

    await expect(manager.readArtifact('../secret')).rejects.toThrow('Artifact path is invalid');
  });
});
