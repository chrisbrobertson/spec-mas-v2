import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

describe('runs read endpoints', () => {
  it('returns runs list and run detail on happy path', async () => {
    const app = createServer();

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
    const detail = detailResponse.json<{ run: { id: string }; phases: Array<{ runId: string }> }>();
    expect(detail.run.id).toBe('run-2');
    expect(detail.phases).toHaveLength(2);
    expect(detail.phases.every((phase) => phase.runId === 'run-2')).toBe(true);

    await app.close();
  });

  it('returns run artifacts and logs for known runs', async () => {
    const app = createServer();

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

    await app.close();
  });

  it('returns edge-case errors for missing runs and missing roles', async () => {
    const app = createServer();

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

    await app.close();
  });
});
