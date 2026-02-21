import { describe, expect, it } from 'vitest';
import { InMemoryRunQueryService } from '../src/runQueryService.js';
import { createServer } from '../src/server.js';

function createRunQueryService() {
  return new InMemoryRunQueryService([
    {
      run: {
        id: 'run-2',
        projectId: 'alpha',
        status: 'running',
        startedAt: '2026-02-20T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: 'specmas/run-2/issue-201',
        integrationBranch: 'specmas/run-2/integration',
        releaseBranch: 'specmas/run-2/release',
        mergeStatus: 'awaiting_human_approval'
      }
    },
    {
      run: {
        id: 'run-1',
        projectId: 'alpha',
        status: 'passed',
        startedAt: '2026-02-19T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: 'specmas/run-1/issue-101',
        integrationBranch: 'specmas/run-1/integration',
        releaseBranch: 'specmas/run-1/release',
        mergeStatus: 'awaiting_human_approval'
      }
    }
  ]);
}

describe('merge approval endpoints', () => {
  it('enforces human-approval before merge and supports transitions', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const initial = await app.inject({
      method: 'GET',
      url: '/runs/run-1/merge-approval',
      headers: { 'x-role': 'viewer' }
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json()).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        status: 'awaiting_human_approval'
      })
    );

    const invalidMerge = await app.inject({
      method: 'POST',
      url: '/runs/run-1/merge-approval',
      headers: { 'x-role': 'operator' },
      payload: {
        action: 'merge'
      }
    });
    expect(invalidMerge.statusCode).toBe(409);
    expect(invalidMerge.json()).toEqual({
      error: 'invalid merge transition: awaiting_human_approval -> merge'
    });

    const approve = await app.inject({
      method: 'POST',
      url: '/runs/run-1/merge-approval',
      headers: { 'x-role': 'operator' },
      payload: {
        action: 'approve'
      }
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json()).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        status: 'approved'
      })
    );

    const merge = await app.inject({
      method: 'POST',
      url: '/runs/run-1/merge-approval',
      headers: { 'x-role': 'operator' },
      payload: {
        action: 'merge'
      }
    });
    expect(merge.statusCode).toBe(200);
    expect(merge.json()).toEqual(
      expect.objectContaining({
        runId: 'run-1',
        status: 'merged'
      })
    );

    await app.close();
  });

  it('blocks merge for non-passed runs', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    await app.inject({
      method: 'POST',
      url: '/runs/run-2/merge-approval',
      headers: { 'x-role': 'operator' },
      payload: {
        action: 'approve'
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/runs/run-2/merge-approval',
      headers: { 'x-role': 'operator' },
      payload: {
        action: 'merge'
      }
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'cannot merge run with status running'
    });

    await app.close();
  });
});
