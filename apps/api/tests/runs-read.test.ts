import { describe, expect, it } from 'vitest';
import { InMemoryRunQueryService } from '../src/runQueryService.js';
import { createServer } from '../src/server.js';

describe('runs read endpoints', () => {
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
        },
        phases: [
          {
            id: 'phase-1',
            runId: 'run-2',
            name: 'Implement',
            status: 'running'
          },
          {
            id: 'phase-2',
            runId: 'run-2',
            name: 'Test',
            status: 'pending'
          }
        ],
        logs: [
          {
            runId: 'run-2',
            sequence: 1,
            timestamp: '2026-02-20T00:00:01.000Z',
            message: 'run started',
            level: 'info'
          },
          {
            runId: 'run-2',
            sequence: 2,
            timestamp: '2026-02-20T00:00:02.000Z',
            message: 'phase implement in progress',
            level: 'warn'
          },
          {
            runId: 'run-2',
            sequence: 3,
            timestamp: '2026-02-20T00:00:03.000Z',
            message: 'tests queued',
            level: 'info'
          }
        ],
        artifacts: {
          runId: 'run-2',
          paths: ['validation/gate-results.json', 'run-summary.md', 'phases/test/coverage-report.html'],
          contents: {
            'validation/gate-results.json': JSON.stringify({ gates: ['G1', 'G2'], status: 'ok' }),
            'run-summary.md': '# Run Summary',
            'phases/test/coverage-report.html': '<html><head><title>Coverage</title></head><body>ok</body></html>'
          }
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

  it('returns runs list and run detail on happy path', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/runs',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json<{ runs: Array<{ id: string }> }>().runs.map((run) => run.id)).toEqual([
      'run-2',
      'run-1'
    ]);

    const detailResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-2',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json<{
      run: {
        id: string;
        workingBranch: string;
      };
      phases: Array<{ runId: string }>;
    }>();
    expect(detail.run.id).toBe('run-2');
    expect(detail.run.workingBranch).toBe('specmas/run-2/issue-201');
    expect(detail.phases).toHaveLength(2);
    expect(detail.phases.every((phase) => phase.runId === 'run-2')).toBe(true);

    await app.close();
  });

  it('returns run artifacts and logs for known runs', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const artifactsResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-2/artifacts',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(artifactsResponse.statusCode).toBe(200);
    expect(artifactsResponse.json<{ runId: string; paths: string[] }>()).toMatchObject({
      runId: 'run-2',
      paths: ['validation/gate-results.json', 'run-summary.md', 'phases/test/coverage-report.html']
    });

    const logsResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-2/logs',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json<{ entries: Array<{ sequence: number }> }>().entries.map((entry) => entry.sequence)).toEqual([
      1,
      2,
      3
    ]);

    const streamResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-2/logs/stream?after=1',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.headers['content-type']).toContain('text/event-stream');
    expect(streamResponse.body).toContain('id: 2');
    expect(streamResponse.body).toContain('id: 3');
    expect(streamResponse.body).not.toContain('id: 1');
    expect(streamResponse.body).toContain('event: end');

    await app.close();
  });

  it('returns edge-case errors for missing runs and missing roles', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const missingRunResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-999',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(missingRunResponse.statusCode).toBe(404);
    expect(missingRunResponse.json()).toEqual({ error: 'run not found: run-999' });

    const missingRoleResponse = await app.inject({
      method: 'GET',
      url: '/runs'
    });
    expect(missingRoleResponse.statusCode).toBe(403);
    expect(missingRoleResponse.json()).toEqual({ error: 'access denied: role is required' });

    const invalidAfterResponse = await app.inject({
      method: 'GET',
      url: '/runs/run-2/logs/stream?after=NaN',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(invalidAfterResponse.statusCode).toBe(400);
    expect(invalidAfterResponse.json()).toEqual({ error: 'invalid after sequence: NaN' });

    await app.close();
  });

  it('filters runs by project and branch', async () => {
    const app = createServer({
      runQueryService: createRunQueryService()
    });

    const projectResponse = await app.inject({
      method: 'GET',
      url: '/runs?projectId=alpha',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(projectResponse.statusCode).toBe(200);
    expect(projectResponse.json<{ runs: Array<{ id: string }> }>().runs).toHaveLength(2);

    const branchResponse = await app.inject({
      method: 'GET',
      url: '/runs?projectId=alpha&branch=specmas/run-2/issue-201',
      headers: {
        'x-role': 'viewer'
      }
    });
    expect(branchResponse.statusCode).toBe(200);
    expect(branchResponse.json<{ runs: Array<{ id: string }> }>().runs.map((run) => run.id)).toEqual(['run-2']);

    await app.close();
  });
});
