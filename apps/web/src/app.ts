export type DashboardRouteKey = 'runs' | 'run-detail' | 'artifacts' | 'log-stream' | 'authoring';

export interface DashboardRoute {
  key: DashboardRouteKey;
  path: string;
  title: string;
}

export interface DashboardState {
  apiHealthy: boolean;
  routes: DashboardRoute[];
  lastHealthCheckAt: string | null;
}

export interface HealthProbeClient {
  ping(): Promise<{ status: string }>;
}

export interface DashboardClock {
  now(): string;
}

export interface DashboardShell {
  getState(): DashboardState;
  load(): Promise<DashboardState>;
}

const ROUTE_SKELETON: DashboardRoute[] = [
  { key: 'runs', path: '/projects/:projectId/runs', title: 'Runs' },
  { key: 'run-detail', path: '/projects/:projectId/runs/:runId', title: 'Run Detail' },
  { key: 'artifacts', path: '/projects/:projectId/runs/:runId/artifacts', title: 'Artifact Explorer' },
  { key: 'log-stream', path: '/projects/:projectId/runs/:runId/logs', title: 'Live Log Stream' },
  { key: 'authoring', path: '/authoring', title: 'Spec Authoring' }
];

export function createRouteSkeleton(): DashboardRoute[] {
  return ROUTE_SKELETON.map((route) => ({ ...route }));
}

export function createDeterministicDashboardClock(
  startAtIso = '2026-01-01T00:00:00.000Z',
  stepMs = 1000
): DashboardClock {
  let current = Date.parse(startAtIso);

  return {
    now() {
      const timestamp = new Date(current).toISOString();
      current += stepMs;
      return timestamp;
    }
  };
}

export function createInitialDashboardState(): DashboardState {
  return {
    apiHealthy: false,
    routes: createRouteSkeleton(),
    lastHealthCheckAt: null
  };
}

export function createDashboardShell(
  healthProbeClient: HealthProbeClient,
  clock: DashboardClock = createDeterministicDashboardClock()
): DashboardShell {
  let state = createInitialDashboardState();

  return {
    getState() {
      return state;
    },
    async load() {
      let apiHealthy = false;

      try {
        const response = await healthProbeClient.ping();
        apiHealthy = response.status === 'ok';
      } catch {
        apiHealthy = false;
      }

      state = {
        ...state,
        apiHealthy,
        lastHealthCheckAt: clock.now()
      };

      return state;
    }
  };
}
