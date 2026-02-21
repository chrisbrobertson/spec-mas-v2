import { describe, expect, it } from 'vitest';
import { decomposeRequirements, toIssuePayload } from '../src/decomposition.js';

describe('issue decomposition', () => {
  it('maps FR to deterministic issue payload', () => {
    const payload = toIssuePayload({
      id: 'FR-001',
      title: 'Run workflow',
      description: 'Run workflow from issue queue',
      dependsOn: ['12', '11', '12'],
      acceptanceCriteria: ['runs tasks', 'emits artifacts']
    });

    expect(payload.title).toBe('[FR-001] Run workflow');
    expect(payload.dependencies).toEqual(['11', '12']);
    expect(payload.body).toContain('## Acceptance Criteria');
  });

  it('decomposes list of requirements', () => {
    const payloads = decomposeRequirements([
      {
        id: 'FR-001',
        title: 'One',
        description: 'desc',
        acceptanceCriteria: ['a']
      },
      {
        id: 'FR-002',
        title: 'Two',
        description: 'desc',
        acceptanceCriteria: ['b']
      }
    ]);

    expect(payloads).toHaveLength(2);
  });

  it('fails when requirement has no acceptance criteria', () => {
    expect(() =>
      toIssuePayload({
        id: 'FR-003',
        title: 'Bad',
        description: 'desc',
        acceptanceCriteria: []
      })
    ).toThrow('must include acceptance criteria');
  });
});
