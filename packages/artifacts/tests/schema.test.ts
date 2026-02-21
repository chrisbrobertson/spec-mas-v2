import { describe, expect, it } from 'vitest';
import { validateArtifactManifest } from '../src/schema.js';

describe('artifact manifest schema', () => {
  it('accepts valid manifest', () => {
    const result = validateArtifactManifest({
      artifactId: 'a1',
      runId: 'r1',
      phaseId: 'p1',
      taskId: 't1',
      kind: 'json',
      path: 'r1/p1/t1/a1.json',
      createdAt: '2026-01-01T00:00:00.000Z',
      checksum: 'abc123',
      sizeBytes: 10
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns field-level validation errors', () => {
    const result = validateArtifactManifest({
      artifactId: '',
      runId: 'r1',
      phaseId: 'p1',
      taskId: 't1',
      kind: 'unknown',
      path: '../bad',
      createdAt: 'bad-date',
      checksum: '',
      sizeBytes: -1
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'artifactId must be a non-empty string',
        'kind must be one of: log, report, json, diff, html, sarif',
        'path cannot include traversal segments',
        'createdAt must be an ISO timestamp'
      ])
    );
  });

  it('fails when manifest is not an object', () => {
    const result = validateArtifactManifest(null);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toBe('Manifest must be an object');
  });
});
