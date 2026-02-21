import { describe, expect, it } from 'vitest';
import { createRouteSkeleton } from '../src/app.js';
import { materializeRoutePath, materializeRoutes, resolveRoute } from '../src/runtime/routes.js';

describe('runtime-routes', () => {
  it('materializes route templates with a run id', () => {
    expect(materializeRoutePath('/projects/:projectId/runs/:runId/artifacts', 'run-9', 'beta')).toBe(
      '/projects/beta/runs/run-9/artifacts'
    );

    const routes = materializeRoutes(createRouteSkeleton(), 'run-9', 'beta');
    expect(routes.find((route) => route.key === 'artifacts')?.path).toBe('/projects/beta/runs/run-9/artifacts');
  });

  it('resolves known core paths', () => {
    expect(resolveRoute('/projects/alpha/runs')).toEqual({ key: 'runs' });
    expect(resolveRoute('/projects/alpha/runs/run-9')).toEqual({ key: 'run-detail', runId: 'run-9' });
    expect(resolveRoute('/projects/alpha/runs/run-9/artifacts')).toEqual({ key: 'artifacts', runId: 'run-9' });
    expect(resolveRoute('/projects/alpha/runs/run-9/logs')).toEqual({ key: 'log-stream', runId: 'run-9' });
    expect(resolveRoute('/authoring')).toEqual({ key: 'authoring' });
  });

  it('returns undefined for unknown route edge cases', () => {
    expect(resolveRoute('/')).toBeUndefined();
    expect(resolveRoute('/unknown/path')).toBeUndefined();
  });
});
