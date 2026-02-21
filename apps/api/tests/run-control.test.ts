import { describe, expect, it } from 'vitest';
import type { RunControlService } from '../src/runControlService.js';
import type { RunQueryService, RunRecord } from '../src/runQueryService.js';
import { createServer } from '../src/server.js';

class MutableRunQueryService implements RunQueryService {
  readonly runs = new Map<string, RunRecord>();

  async listRuns() {
    return [...this.runs.values()];
  }

  async loadRun(runId: string) {
    return this.runs.get(runId);
  }

  async loadRunPhases() {
    return [];
  }

  async loadRunLogs() {
    return [];
  }

  async loadRunLogsAfter() {
    return [];
  }

  async loadRunArtifacts() {
    return undefined;
  }

  async listProjects() {
    return [];
  }

  async loadProject() {
    return undefined;
  }

  async loadProjectBranches() {
    return undefined;
  }
}

class MutableRunControlService implements RunControlService {
  constructor(private readonly runs: Map<string, RunRecord>) {}

  async startRun(input: { projectId: string }) {
    const runId = 'run-1000';
    this.runs.set(runId, {
      id: runId,
      projectId: input.projectId,
      status: 'running',
      startedAt: '2026-02-21T00:00:00.000Z',
      sourceBranch: 'main',
      workingBranch: 'specmas/run-1000/task-default',
      integrationBranch: 'specmas/run-1000/integration',
      releaseBranch: 'specmas/run-1000/release',
      mergeStatus: 'awaiting_human_approval'
    });
    return { runId };
  }

  async cancelRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) {
      return false;
    }
    this.runs.set(runId, {
      ...run,
      status: 'cancelled',
      mergeStatus: 'rejected'
    });
    return true;
  }
}

describe('run control routes', () => {
  it('starts and cancels runs on happy path', async () => {
    const query = new MutableRunQueryService();
    const control = new MutableRunControlService(query.runs);
    const app = createServer({
      runQueryService: query,
      runControlService: control
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        projectId: 'alpha'
      }
    });

    expect(startResponse.statusCode).toBe(201);
    expect(startResponse.json<{ run: { id: string; status: string } }>()).toEqual({
      run: expect.objectContaining({
        id: 'run-1000',
        status: 'running'
      })
    });

    const cancelResponse = await app.inject({
      method: 'POST',
      url: '/runs/run-1000/cancel',
      headers: {
        'x-role': 'developer'
      }
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json<{ run: { id: string; status: string } }>()).toEqual({
      run: expect.objectContaining({
        id: 'run-1000',
        status: 'cancelled'
      })
    });

    await app.close();
  });

  it('returns validation and not-found errors for failure paths', async () => {
    const query = new MutableRunQueryService();
    const control = new MutableRunControlService(query.runs);
    const app = createServer({
      runQueryService: query,
      runControlService: control
    });

    const missingProject = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: {
        'x-role': 'developer'
      },
      payload: {}
    });

    expect(missingProject.statusCode).toBe(400);
    expect(missingProject.json()).toEqual({ error: 'projectId is required' });

    const missingRun = await app.inject({
      method: 'POST',
      url: '/runs/run-404/cancel',
      headers: {
        'x-role': 'developer'
      }
    });

    expect(missingRun.statusCode).toBe(404);
    expect(missingRun.json()).toEqual({ error: 'run not found: run-404' });

    await app.close();
  });

  it('returns edge-case 500 when run is started but unreadable', async () => {
    const query = new MutableRunQueryService();
    const app = createServer({
      runQueryService: query,
      runControlService: {
        async startRun() {
          return { runId: 'run-edge-1' };
        },
        async cancelRun() {
          return false;
        }
      }
    });

    const startResponse = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        projectId: 'alpha'
      }
    });

    expect(startResponse.statusCode).toBe(500);
    expect(startResponse.json()).toEqual({ error: 'run persisted but not readable: run-edge-1' });

    await app.close();
  });
});
