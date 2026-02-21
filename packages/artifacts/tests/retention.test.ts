import { describe, expect, it } from 'vitest';
import { evaluateRetention } from '../src/retention.js';
import type { ArtifactManifest } from '../src/schema.js';

function manifest(artifactId: string, createdAt: string): ArtifactManifest {
  return {
    artifactId,
    runId: 'r1',
    phaseId: 'p1',
    taskId: 't1',
    kind: 'report',
    path: `r1/p1/t1/${artifactId}.md`,
    createdAt,
    checksum: `checksum-${artifactId}`,
    sizeBytes: 10
  };
}

describe('artifact retention policy', () => {
  it('keeps newest artifacts and deletes aged/overflow entries', () => {
    const decision = evaluateRetention(
      [
        manifest('a-1', '2026-01-05T00:00:00.000Z'),
        manifest('a-2', '2026-01-04T00:00:00.000Z'),
        manifest('a-3', '2025-12-01T00:00:00.000Z')
      ],
      {
        maxAgeDays: 30,
        maxArtifactsPerTask: 2,
        dryRun: true,
        safeMode: true
      },
      new Date('2026-01-10T00:00:00.000Z')
    );

    expect(decision.keep.map((entry) => entry.artifactId)).toEqual(['a-1', 'a-2']);
    expect(decision.delete.map((entry) => entry.artifactId)).toEqual(['a-3']);
    expect(decision.reasonByArtifactId['a-3']).toBe('expired');
  });

  it('rejects invalid retention policy', () => {
    expect(() =>
      evaluateRetention(
        [],
        {
          maxAgeDays: -1,
          maxArtifactsPerTask: 2,
          dryRun: true,
          safeMode: true
        },
        new Date('2026-01-10T00:00:00.000Z')
      )
    ).toThrow('Retention policy values are invalid');
  });

  it('requires safe mode for non-dry-run cleanup', () => {
    expect(() =>
      evaluateRetention(
        [manifest('a-1', '2026-01-05T00:00:00.000Z')],
        {
          maxAgeDays: 10,
          maxArtifactsPerTask: 1,
          dryRun: false,
          safeMode: false
        },
        new Date('2026-01-10T00:00:00.000Z')
      )
    ).toThrow('Retention cleanup requires safeMode when dryRun is disabled');
  });
});
