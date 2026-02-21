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
import { buildRunDetailView, buildRunListView } from '../runViews.js';
import { resolveApiBaseUrl } from './config.js';
import { DEMO_ARTIFACT_CONTENT, DEMO_ARTIFACT_PATHS, DEMO_PHASES, DEMO_RUNS } from './demoData.js';
import { materializeRoutes } from './routes.js';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const NAV_ROUTES = materializeRoutes(createRouteSkeleton());

function nowIso(): string {
  return new Date().toISOString();
}

function useDashboardState(): [DashboardState, () => Promise<void>] {
  const shell = useMemo(
    () =>
      createDashboardShell(
        {
          async ping() {
            const response = await fetch(`${API_BASE_URL}/health`);
            if (!response.ok) {
              throw new Error(`health check failed: ${response.status}`);
            }
            return (await response.json()) as { status: string };
          }
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
  const runItems = buildRunListView(DEMO_RUNS);

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
  const run = DEMO_RUNS.find((candidate) => candidate.id === params.runId);

  if (!run) {
    return (
      <section>
        <h2>Run Detail</h2>
        <p>Unknown run: {params.runId}</p>
      </section>
    );
  }

  const detail = buildRunDetailView(run, DEMO_PHASES);

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
  const [selectedPath, setSelectedPath] = useState<string>(DEMO_ARTIFACT_PATHS[0]);
  const tree = buildArtifactTree(DEMO_ARTIFACT_PATHS);
  const content = DEMO_ARTIFACT_CONTENT[selectedPath] ?? '';
  const preview = renderArtifactPreview(selectedPath, content);

  return (
    <section>
      <h2>Artifacts</h2>
      <p>Root nodes: {tree.children.map((node) => node.name).join(', ')}</p>
      <div className="stack">
        {DEMO_ARTIFACT_PATHS.map((artifactPath) => (
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
  const modelRef = useRef<LiveLogStreamModel>(new LiveLogStreamModel());
  const [snapshot, setSnapshot] = useState<LogStreamState>(modelRef.current.snapshot());

  const refresh = () => setSnapshot(modelRef.current.snapshot());

  const connect = () => {
    modelRef.current.connect(nowIso());
    refresh();
  };

  const seed = () => {
    modelRef.current.receive({
      runId: 'run-2',
      sequence: 2,
      timestamp: nowIso(),
      message: 'second',
      level: 'info'
    });
    modelRef.current.receive({
      runId: 'run-2',
      sequence: 1,
      timestamp: nowIso(),
      message: 'first',
      level: 'info'
    });
    modelRef.current.receive({
      runId: 'run-2',
      sequence: 3,
      timestamp: nowIso(),
      message: 'third',
      level: 'warn'
    });
    refresh();
  };

  const disconnect = () => {
    modelRef.current.disconnect(nowIso(), 'network issue');
    refresh();
  };

  const reconnect = () => {
    modelRef.current.reconnect(nowIso());
    refresh();
  };

  return (
    <section>
      <h2>Live Log Stream</h2>
      <div className="stack">
        <button type="button" onClick={connect}>
          Connect
        </button>
        <button type="button" onClick={seed}>
          Seed Logs
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

  const update = (mutate: () => AuthoringFlowState) => {
    try {
      const next = mutate();
      setState(next);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unknown authoring error');
    }
  };

  return (
    <section>
      <h2>Spec Authoring</h2>
      <p>
        Mode: <strong>{state.mode}</strong> | Active: <strong>{state.activeSectionId ?? '-'}</strong>
      </p>
      <p>Accessible: {accessibleSections(state).join(', ')}</p>
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
