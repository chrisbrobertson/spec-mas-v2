import { describe, expect, it } from 'vitest';
import { compareCriticalPathSnapshots, serializeCriticalPath } from '../src/criticalPath.js';

describe('critical path e2e snapshot', () => {
  it('serializes snapshot deterministically', () => {
    const serialized = serializeCriticalPath({
      specId: 'spec-1',
      issueIds: ['issue-2', 'issue-1'],
      runId: 'run-1',
      artifactIds: ['artifact-b', 'artifact-a']
    });

    expect(serialized).toContain('"issueIds": [\n    "issue-1",\n    "issue-2"\n  ]');
    expect(serialized).toContain('"artifactIds": [\n    "artifact-a",\n    "artifact-b"\n  ]');
  });

  it('passes when expected and actual snapshots match', () => {
    const expected = {
      specId: 'spec-1',
      issueIds: ['issue-1'],
      runId: 'run-1',
      artifactIds: ['artifact-1']
    };
    const actual = {
      specId: 'spec-1',
      issueIds: ['issue-1'],
      runId: 'run-1',
      artifactIds: ['artifact-1']
    };

    expect(compareCriticalPathSnapshots(expected, actual).pass).toBe(true);
  });

  it('fails when snapshot diverges', () => {
    const expected = {
      specId: 'spec-1',
      issueIds: ['issue-1'],
      runId: 'run-1',
      artifactIds: ['artifact-1']
    };
    const actual = {
      specId: 'spec-1',
      issueIds: ['issue-2'],
      runId: 'run-1',
      artifactIds: ['artifact-1']
    };

    const result = compareCriticalPathSnapshots(expected, actual);
    expect(result.pass).toBe(false);
    expect(result.diff).toEqual(['critical-path snapshot mismatch']);
  });
});
