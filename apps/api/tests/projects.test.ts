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
      },
      {
        projectId: 'beta',
        name: 'Beta Service',
        repoUrl: 'https://github.com/specmas/beta',
        defaultBranch: 'develop'
      }
    ]
  );
}

describe('project endpoints', () => {
  it('lists projects with deterministic schema', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const response = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { 'x-role': 'viewer' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projects: [
        {
          projectId: 'alpha',
          name: 'Alpha Service',
          repoUrl: 'https://github.com/specmas/alpha',
          defaultBranch: 'main',
          activeRunCount: 1
        },
        {
          projectId: 'beta',
          name: 'Beta Service',
          repoUrl: 'https://github.com/specmas/beta',
          defaultBranch: 'develop',
          activeRunCount: 0
        }
      ]
    });

    await app.close();
  });

  it('loads project detail and returns not found for unknown ids', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/projects/alpha',
      headers: { 'x-role': 'viewer' }
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toEqual({
      project: {
        projectId: 'alpha',
        name: 'Alpha Service',
        repoUrl: 'https://github.com/specmas/alpha',
        defaultBranch: 'main',
        activeRunCount: 1
      }
    });

    const missingResponse = await app.inject({
      method: 'GET',
      url: '/projects/missing',
      headers: { 'x-role': 'viewer' }
    });
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json()).toEqual({ error: 'project not found: missing' });

    await app.close();
  });
});
