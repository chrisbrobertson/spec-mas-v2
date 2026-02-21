import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { createDashboardShell, createRouteSkeleton, type DashboardState } from '../app.js';
import { buildArtifactTree, renderArtifactPreview } from '../artifactExplorer.js';
import {
  accessibleSections,
  createAuthoringFlowState,
  editSection,
  submitGuidedAnswer,
  switchAuthoringMode,
  type AuthoringFlowState
} from '../authoringFlow.js';
import { LiveLogStreamModel, type LogStreamState } from '../logStream.js';
import { buildRunDetailView, buildRunListView, type RunRecord } from '../runViews.js';
import { createApiClient } from './apiClient.js';
import { resolveApiBaseUrl } from './config.js';
import { materializeRoutes } from './routes.js';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const runtimeApiClient = createApiClient(API_BASE_URL);
const NAV_ROUTES = materializeRoutes(createRouteSkeleton());

function nowIso(): string {
  return new Date().toISOString();
}

function useDashboardState(): [DashboardState, () => Promise<void>] {
  const shell = useMemo(
    () =>
      createDashboardShell(
        {
          ping: () => runtimeApiClient.getHealth()
        },
        {
          now: nowIso
        }
      ),
    []
  );

  const [state, setState] = useState<DashboardState>(shell.getState());

  const refresh = async () => {
    const loaded = await shell.load();
    setState(loaded);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return [state, refresh];
}

function formatLogState(state: LogStreamState): string {
  const sequences = state.logs.map((entry) => entry.sequence).join(',');
  return `connected=${state.connected} reconnects=${state.reconnectCount} last=${state.lastSequence} seq=[${sequences}]`;
}

function RunsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await runtimeApiClient.getRuns();
        if (!active) {
          return;
        }
        setRuns(response.runs);
        setError('');
      } catch (caughtError) {
        if (!active) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load runs');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section>
        <h2>Runs</h2>
        <p>Loading runs...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2>Runs</h2>
        <p className="error">Failed to load runs: {error}</p>
      </section>
    );
  }

  const runItems = buildRunListView(runs);

  return (
    <section>
      <h2>Runs</h2>
      <ul>
        {runItems.map((item) => (
          <li key={item.id}>
            <strong>{item.id}</strong> {item.badge.label} ({item.projectId}){' '}
            <Link to={`/runs/${item.id}`}>Open</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? '';
  const [detail, setDetail] = useState<ReturnType<typeof buildRunDetailView> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await runtimeApiClient.getRunDetail(runId);
        if (!active) {
          return;
        }
        setDetail(buildRunDetailView(response.run, response.phases));
        setError('');
      } catch (caughtError) {
        if (!active) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : `Failed to load run: ${runId}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [runId]);

  if (loading) {
    return (
      <section>
        <h2>Run Detail</h2>
        <p>Loading run detail...</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section>
        <h2>Run Detail</h2>
        <p className="error">{error || `Unknown run: ${runId}`}</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Run Detail</h2>
      <p>
        <strong>{detail.runId}</strong> {detail.badge.label}
      </p>
      <p>
        <Link to={`/runs/${detail.runId}/artifacts`}>Artifacts</Link> |{' '}
        <Link to={`/runs/${detail.runId}/logs`}>Logs</Link>
      </p>
      <ol>
        {detail.timeline.map((phase) => (
          <li key={phase.phaseId}>
            {phase.sequence}. {phase.name} - {phase.badge.label}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ArtifactsPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? '';
  const [paths, setPaths] = useState<string[]>([]);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await runtimeApiClient.getRunArtifacts(runId);
        if (!active) {
          return;
        }
        setPaths(response.paths);
        setContents(response.contents);
        setSelectedPath(response.paths[0] ?? '');
        setError('');
      } catch (caughtError) {
        if (!active) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : `Failed to load artifacts: ${runId}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [runId]);

  if (loading) {
    return (
      <section>
        <h2>Artifacts</h2>
        <p>Loading artifacts...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h2>Artifacts</h2>
        <p className="error">{error}</p>
      </section>
    );
  }

  const tree = buildArtifactTree(paths);
  const content = selectedPath ? contents[selectedPath] ?? '' : '';
  const preview = selectedPath ? renderArtifactPreview(selectedPath, content) : { renderer: 'text', summary: 'No artifact selected' };

  return (
    <section>
      <h2>Artifacts</h2>
      <p>Root nodes: {tree.children.map((node) => node.name).join(', ') || '(none)'}</p>
      <div className="stack">
        {paths.map((artifactPath) => (
          <button type="button" key={artifactPath} onClick={() => setSelectedPath(artifactPath)}>
            {artifactPath}
          </button>
        ))}
      </div>
      <p>
        Renderer: <strong>{preview.renderer}</strong>
      </p>
      <p>{preview.summary}</p>
    </section>
  );
}

function LogStreamPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? '';
  const modelRef = useRef<LiveLogStreamModel>(new LiveLogStreamModel());
  const [snapshot, setSnapshot] = useState<LogStreamState>(modelRef.current.snapshot());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = () => setSnapshot(modelRef.current.snapshot());

  useEffect(() => {
    let active = true;
    modelRef.current = new LiveLogStreamModel();
    setSnapshot(modelRef.current.snapshot());

    void (async () => {
      try {
        const response = await runtimeApiClient.getRunLogs(runId);
        if (!active) {
          return;
        }

        modelRef.current.connect(nowIso());
        for (const entry of response.entries) {
          modelRef.current.receive(entry);
        }

        setError('');
        refresh();
      } catch (caughtError) {
        if (!active) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : `Failed to load logs: ${runId}`);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [runId]);

  const connect = () => {
    modelRef.current.connect(nowIso());
    refresh();
  };

  const disconnect = () => {
    modelRef.current.disconnect(nowIso(), 'manual disconnect');
    refresh();
  };

  const reconnect = () => {
    modelRef.current.reconnect(nowIso());
    refresh();
  };

  return (
    <section>
      <h2>Live Log Stream</h2>
      {loading ? <p>Loading logs...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="stack">
        <button type="button" onClick={connect}>
          Connect
        </button>
        <button type="button" onClick={disconnect}>
          Disconnect
        </button>
        <button type="button" onClick={reconnect}>
          Reconnect
        </button>
      </div>
      <p>{formatLogState(snapshot)}</p>
      <p>Timeline: {snapshot.timeline.map((entry) => entry.type).join(', ')}</p>
    </section>
  );
}

function AuthoringPage() {
  const [state, setState] = useState<AuthoringFlowState>(createAuthoringFlowState('guided'));
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState('session not started');

  const update = (mutate: () => AuthoringFlowState) => {
    try {
      const next = mutate();
      setState(next);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unknown authoring error');
    }
  };

  const createSession = async () => {
    try {
      const session = await runtimeApiClient.createSession({
        specId: 'spec-runtime',
        mode: state.mode
      });
      setSessionId(session.id);
      setSyncStatus(`session ${session.id} ready`);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create session');
    }
  };

  const syncSession = async () => {
    if (!sessionId) {
      setError('Create a session before syncing');
      return;
    }

    try {
      const session = await runtimeApiClient.resumeSession(sessionId, {
        message: `mode=${state.mode};active=${state.activeSectionId ?? 'none'}`
      });
      setSyncStatus(`synced messages=${session.messages.length}`);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to sync session');
    }
  };

  return (
    <section>
      <h2>Spec Authoring</h2>
      <p>
        Mode: <strong>{state.mode}</strong> | Active: <strong>{state.activeSectionId ?? '-'}</strong>
      </p>
      <p>Accessible: {accessibleSections(state).join(', ')}</p>
      <p>Remote: {syncStatus}</p>
      <div className="stack">
        <button type="button" onClick={() => update(() => submitGuidedAnswer(state, 'Payment service overview'))}>
          Submit Guided Answer
        </button>
        <button type="button" onClick={() => update(() => switchAuthoringMode(state, 'edit'))}>
          Switch to Edit
        </button>
        <button type="button" onClick={() => update(() => editSection(state, 'data-model', 'Entity: Payment'))}>
          Edit Data Model
        </button>
        <button type="button" onClick={() => update(() => switchAuthoringMode(state, 'freeform'))}>
          Switch to Freeform
        </button>
        <button type="button" onClick={() => void createSession()}>
          Create Session
        </button>
        <button type="button" onClick={() => void syncSession()}>
          Sync Session
        </button>
      </div>
      {error ? <p className="error">Error: {error}</p> : null}
      <ul>
        {state.sections.map((section) => (
          <li key={section.id}>
            {section.title}: {section.completed ? 'complete' : 'pending'}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RuntimeApp() {
  const [dashboardState, refreshHealth] = useDashboardState();

  return (
    <main className="layout">
      <header>
        <h1>Spec-MAS Dashboard</h1>
        <p>
          API: {API_BASE_URL} | Health: <strong>{dashboardState.apiHealthy ? 'healthy' : 'unhealthy'}</strong>
        </p>
        <p>Last check: {dashboardState.lastHealthCheckAt ?? 'never'}</p>
        <button type="button" onClick={() => void refreshHealth()}>
          Refresh Health
        </button>
      </header>

      <nav>
        {NAV_ROUTES.map((route) => (
          <Link key={route.key} to={route.path}>
            {route.title}
          </Link>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/runs" replace />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/runs/:runId/artifacts" element={<ArtifactsPage />} />
        <Route path="/runs/:runId/logs" element={<LogStreamPage />} />
        <Route path="/authoring" element={<AuthoringPage />} />
        <Route path="*" element={<Navigate to="/runs" replace />} />
      </Routes>
    </main>
  );
}
