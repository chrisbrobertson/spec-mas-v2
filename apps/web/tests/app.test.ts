import { describe, expect, it } from 'vitest';
import {
  createDashboardShell,
  createDeterministicDashboardClock,
  createInitialDashboardState
} from '../src/app.js';

describe('web shell', () => {
  it('creates route skeleton and becomes healthy when ping succeeds', async () => {
    const shell = createDashboardShell(
      {
        async ping() {
          return { status: 'ok' };
        }
      },
      createDeterministicDashboardClock('2026-02-19T00:00:00.000Z', 1000)
    );

    expect(createInitialDashboardState()).toEqual({
      apiHealthy: false,
      routes: [
        { key: 'runs', path: '/runs', title: 'Runs' },
        { key: 'run-detail', path: '/runs/:runId', title: 'Run Detail' },
        { key: 'artifacts', path: '/runs/:runId/artifacts', title: 'Artifact Explorer' },
        { key: 'log-stream', path: '/runs/:runId/logs', title: 'Live Log Stream' },
        { key: 'authoring', path: '/authoring', title: 'Spec Authoring' }
      ],
      lastHealthCheckAt: null
    });

    const loaded = await shell.load();
    expect(loaded.apiHealthy).toBe(true);
    expect(loaded.lastHealthCheckAt).toBe('2026-02-19T00:00:00.000Z');
  });

  it('stays unhealthy when ping fails', async () => {
    const shell = createDashboardShell({
      async ping() {
        throw new Error('offline');
      }
    });

    const loaded = await shell.load();
    expect(loaded.apiHealthy).toBe(false);
    expect(loaded.lastHealthCheckAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('treats non-ok status as unhealthy', async () => {
    const shell = createDashboardShell({
      async ping() {
        return { status: 'degraded' };
      }
    });

    const loaded = await shell.load();
    expect(loaded.apiHealthy).toBe(false);
  });
});
