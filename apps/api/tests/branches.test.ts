import { describe, expect, it } from 'vitest';
import { InMemoryRunQueryService } from '../src/runQueryService.js';
import { createServer } from '../src/server.js';

function createRunQueryService() {
  return new InMemoryRunQueryService(
    [
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
    ],
    [
      {
        projectId: 'alpha',
        name: 'Alpha Service',
        repoUrl: 'https://github.com/specmas/alpha',
        defaultBranch: 'main'
      }
    ]
  );
}

describe('project branch inventory endpoints', () => {
  it('returns default/integration/release/active run branches', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/projects/alpha/branches',
      headers: { 'x-role': 'viewer' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projectId: 'alpha',
      defaultBranch: 'main',
      integrationBranches: ['specmas/run-1/integration', 'specmas/run-2/integration'],
      releaseBranches: ['specmas/run-1/release', 'specmas/run-2/release'],
      activeRunBranches: ['specmas/run-1/issue-101', 'specmas/run-2/issue-201']
    });

    await app.close();
  });

  it('returns 404 for unknown project branch inventory', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/projects/missing/branches',
      headers: { 'x-role': 'viewer' }
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'project not found: missing' });

    await app.close();
  });
});
