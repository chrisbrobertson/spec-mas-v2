import type { DashboardRoute } from '../app.js';

export interface ResolvedRoute {
  key: DashboardRoute['key'];
  runId?: string;
}

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function materializeRoutePath(templatePath: string, runId = 'run-2'): string {
  return templatePath.replaceAll(':runId', runId);
}

export function materializeRoutes(routes: DashboardRoute[], runId = 'run-2'): DashboardRoute[] {
  return routes.map((route) => ({
    ...route,
    path: materializeRoutePath(route.path, runId)
  }));
}

export function resolveRoute(pathname: string): ResolvedRoute | undefined {
  const normalized = normalizePathname(pathname);

  if (normalized === '/runs') {
    return { key: 'runs' };
  }

  if (normalized === '/authoring') {
    return { key: 'authoring' };
  }

  const artifactsMatch = normalized.match(/^\/runs\/([^/]+)\/artifacts$/);
  if (artifactsMatch) {
    return { key: 'artifacts', runId: artifactsMatch[1] };
  }

  const logsMatch = normalized.match(/^\/runs\/([^/]+)\/logs$/);
  if (logsMatch) {
    return { key: 'log-stream', runId: logsMatch[1] };
  }

  const detailMatch = normalized.match(/^\/runs\/([^/]+)$/);
  if (detailMatch) {
    return { key: 'run-detail', runId: detailMatch[1] };
  }

  return undefined;
}
