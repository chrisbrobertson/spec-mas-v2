import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
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
import type { ProjectBranchesResponse, ProjectRecord } from './apiClient.js';
import {
  AUTH_SESSION_STORAGE_KEY,
  canWriteSessions,
  isSessionExpired,
  parseStoredSession,
  type AuthSessionRecord
} from './authSession.js';
import { resolveApiBaseUrl } from './config.js';
import {
  artifactsEmptyStateMessage,
  logsEmptyStateMessage,
  runDetailEmptyStateMessage,
  runsEmptyStateMessage
} from './routeStateMessages.js';
import { materializeRoutes } from './routes.js';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const SESSION_EXPIRED_EVENT = 'specmas.auth.session.expired';
const AUTHORING_SESSION_STORAGE_KEY = 'specmas.authoring.session-id';
const SELECTED_PROJECT_STORAGE_KEY = 'specmas.selected.project';

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStoredAccessToken(): string | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }

  const rawValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSessionRecord>;
    return typeof parsed.accessToken === 'string' && parsed.accessToken.length > 0 ? parsed.accessToken : undefined;
  } catch {
    return undefined;
  }
}

function readStoredAuthSession(): AuthSessionRecord | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }

  const rawValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  const parsed = parseStoredSession(rawValue);
  if (!parsed && rawValue) {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
  return parsed;
}

function persistAuthSession(session: AuthSessionRecord): void {
  if (!isBrowserEnvironment()) {
    return;
  }
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredAuthSession(): void {
  if (!isBrowserEnvironment()) {
    return;
  }
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

function readStoredAuthoringSessionId(): string | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }

  const value = localStorage.getItem(AUTHORING_SESSION_STORAGE_KEY);
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function persistAuthoringSessionId(sessionId: string): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  localStorage.setItem(AUTHORING_SESSION_STORAGE_KEY, sessionId);
}

function projectBranchStorageKey(projectId: string): string {
  return `specmas.selected.branch.${projectId}`;
}

function readStoredProjectId(): string | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }
  const value = localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function persistProjectId(projectId: string): void {
  if (!isBrowserEnvironment()) {
    return;
  }
  localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, projectId);
}

function readStoredProjectBranch(projectId: string): string | undefined {
  if (!isBrowserEnvironment()) {
    return undefined;
  }
  const value = localStorage.getItem(projectBranchStorageKey(projectId));
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function persistProjectBranch(projectId: string, branch: string): void {
  if (!isBrowserEnvironment()) {
    return;
  }
  localStorage.setItem(projectBranchStorageKey(projectId), branch);
}

const runtimeApiClient = createApiClient(API_BASE_URL, {
  tokenProvider: readStoredAccessToken,
  onUnauthorized: () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
  }
});

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

interface RunsPageProps {
  projectId: string;
  branchFilter: string;
}

function RunsPage({ projectId, branchFilter }: RunsPageProps) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await runtimeApiClient.getRuns({
          projectId,
          branch: branchFilter === 'all' ? undefined : branchFilter
        });
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
  }, [projectId, branchFilter]);

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
  const emptyState = runsEmptyStateMessage(runItems.length);

  return (
    <section>
      <h2>Runs</h2>
      {emptyState ? <p>{emptyState}</p> : null}
      <ul>
        {runItems.map((item) => (
          <li key={item.id}>
            <strong>{item.id}</strong> {item.badge.label} ({item.projectId})
            {' | '}
            Branch: {item.workingBranch}
            {' | '}
            Merge: {item.mergeStatus}
            {' | '}
            <Link to={`/projects/${projectId}/runs/${item.id}`}>Open</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RunDetailPageProps {
  role: AuthSessionRecord['role'];
}

function RunDetailPage({ role }: RunDetailPageProps) {
  const params = useParams<{ runId: string; projectId: string }>();
  const projectId = params.projectId ?? '';
  const runId = params.runId ?? '';
  const [detail, setDetail] = useState<ReturnType<typeof buildRunDetailView> | null>(null);
  const [mergeStatus, setMergeStatus] = useState<string>('');
  const [mergeError, setMergeError] = useState('');
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
        setMergeStatus(response.run.mergeStatus);
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

  const canUpdateMerge = role === 'admin' || role === 'operator';

  const transitionMerge = async (action: 'approve' | 'reject' | 'merge') => {
    try {
      const response = await runtimeApiClient.updateMergeApproval(runId, action);
      setMergeStatus(response.status);
      setMergeError('');
    } catch (caughtError) {
      setMergeError(caughtError instanceof Error ? caughtError.message : 'Failed to update merge approval');
    }
  };

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

  const emptyState = runDetailEmptyStateMessage(detail.timeline.length);

  return (
    <section>
      <h2>Run Detail</h2>
      <p>
        <strong>{detail.runId}</strong> {detail.badge.label}
      </p>
      <p>
        Project: <strong>{detail.projectId}</strong> | Source: <strong>{detail.sourceBranch}</strong> | Working:{' '}
        <strong>{detail.workingBranch}</strong>
      </p>
      <p>
        Merge status: <strong>{mergeStatus || detail.mergeStatus}</strong>
      </p>
      <div className="stack">
        <button type="button" disabled={!canUpdateMerge} onClick={() => void transitionMerge('approve')}>
          Approve Merge
        </button>
        <button type="button" disabled={!canUpdateMerge} onClick={() => void transitionMerge('reject')}>
          Reject Merge
        </button>
        <button type="button" disabled={!canUpdateMerge} onClick={() => void transitionMerge('merge')}>
          Merge Branch
        </button>
      </div>
      {mergeError ? <p className="error">{mergeError}</p> : null}
      <p>
        <Link to={`/projects/${projectId}/runs/${detail.runId}/artifacts`}>Artifacts</Link> |{' '}
        <Link to={`/projects/${projectId}/runs/${detail.runId}/logs`}>Logs</Link>
      </p>
      {emptyState ? <p>{emptyState}</p> : null}
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
  const emptyState = artifactsEmptyStateMessage(paths.length);

  return (
    <section>
      <h2>Artifacts</h2>
      <p>Root nodes: {tree.children.map((node) => node.name).join(', ') || '(none)'}</p>
      {emptyState ? <p>{emptyState}</p> : null}
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

    const pullStream = async () => {
      const current = modelRef.current.snapshot();
      try {
        const response = await runtimeApiClient.getRunLogStream(runId, current.lastSequence);
        if (!active) {
          return;
        }

        if (!current.connected) {
          if (current.logs.length > 0) {
            modelRef.current.reconnect(nowIso());
          } else {
            modelRef.current.connect(nowIso());
          }
        }

        for (const entry of response.entries) {
          modelRef.current.receive(entry);
        }

        setError('');
        refresh();
      } catch (caughtError) {
        if (!active) {
          return;
        }
        modelRef.current.disconnect(nowIso(), 'stream fetch failed');
        setError(caughtError instanceof Error ? caughtError.message : `Failed to load logs: ${runId}`);
        refresh();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void pullStream();
    const intervalId = setInterval(() => {
      void pullStream();
    }, 3000);

    return () => {
      active = false;
      clearInterval(intervalId);
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

  const emptyState = !loading ? logsEmptyStateMessage(snapshot.logs.length) : undefined;

  return (
    <section>
      <h2>Live Log Stream</h2>
      {loading ? <p>Loading logs...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {emptyState ? <p>{emptyState}</p> : null}
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

interface AuthoringPageProps {
  role: AuthSessionRecord['role'];
}

function AuthoringPage({ role }: AuthoringPageProps) {
  const [state, setState] = useState<AuthoringFlowState>(createAuthoringFlowState('guided'));
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState('session not started');
  const writeEnabled = canWriteSessions(role);

  const update = (mutate: () => AuthoringFlowState) => {
    try {
      const next = mutate();
      setState(next);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unknown authoring error');
    }
  };

  const restoreSession = async (storedSessionId: string) => {
    try {
      const session = await runtimeApiClient.getSession(storedSessionId);
      setSessionId(session.id);
      persistAuthoringSessionId(session.id);
      setSyncStatus(`session ${session.id} restored (${session.messages.length} messages)`);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to restore session');
    }
  };

  useEffect(() => {
    const storedSessionId = readStoredAuthoringSessionId();
    if (!storedSessionId) {
      return;
    }

    void restoreSession(storedSessionId);
  }, []);

  const createSession = async () => {
    if (!writeEnabled) {
      setError(`Role ${role} cannot create authoring sessions`);
      return;
    }

    try {
      const session = await runtimeApiClient.createSession({
        specId: 'spec-runtime',
        mode: state.mode
      });
      setSessionId(session.id);
      persistAuthoringSessionId(session.id);
      setSyncStatus(`session ${session.id} ready`);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create session');
    }
  };

  const syncSession = async () => {
    if (!writeEnabled) {
      setError(`Role ${role} cannot sync authoring sessions`);
      return;
    }

    if (!sessionId) {
      setError('Create a session before syncing');
      return;
    }

    try {
      const session = await runtimeApiClient.resumeSession(sessionId, {
        message: `mode=${state.mode};active=${state.activeSectionId ?? 'none'}`
      });
      persistAuthoringSessionId(session.id);
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
      <p>
        Role: <strong>{role}</strong> | Access: <strong>{writeEnabled ? 'read/write' : 'read-only'}</strong>
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
        <button type="button" onClick={() => void createSession()} disabled={!writeEnabled}>
          Create Session
        </button>
        <button type="button" onClick={() => void syncSession()} disabled={!writeEnabled}>
          Sync Session
        </button>
        <button
          type="button"
          onClick={() => {
            const storedSessionId = readStoredAuthoringSessionId();
            if (!storedSessionId) {
              setError('No stored authoring session found');
              return;
            }
            void restoreSession(storedSessionId);
          }}
        >
          Restore Session
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

interface LoginScreenProps {
  notice: string;
  onLoggedIn: (session: AuthSessionRecord) => void;
}

function LoginScreen({ notice, onLoggedIn }: LoginScreenProps) {
  const [username, setUsername] = useState('developer');
  const [password, setPassword] = useState('developer');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const session = await runtimeApiClient.login({ username, password });
      onLoggedIn(session);
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="layout">
      <header>
        <h1>Spec-MAS Dashboard</h1>
        <p>Sign in to access runs, artifacts, logs, and authoring workflows.</p>
      </header>

      {notice ? <p>{notice}</p> : null}
      {error ? <p className="error">Error: {error}</p> : null}

      <form onSubmit={submit}>
        <label>
          Username
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      <p>Default local users: `admin`, `operator`, `developer`, `viewer` (password matches username).</p>
    </main>
  );
}

function LegacyRunRedirect({ selectedProjectId, suffix }: { selectedProjectId: string; suffix: string }) {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? 'run-2';
  return <Navigate to={`/projects/${selectedProjectId}/runs/${runId}${suffix}`} replace />;
}

function RunsRoute({ selectedBranch }: { selectedBranch: string }) {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ?? 'alpha';
  return <RunsPage projectId={projectId} branchFilter={selectedBranch} />;
}

export function RuntimeApp() {
  const navigate = useNavigate();
  const [dashboardState, refreshHealth] = useDashboardState();
  const [authSession, setAuthSession] = useState<AuthSessionRecord | undefined>(() => readStoredAuthSession());
  const [authNotice, setAuthNotice] = useState(authSession ? '' : 'Please sign in.');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectBranches, setProjectBranches] = useState<ProjectBranchesResponse | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  useEffect(() => {
    const interval = setInterval(() => {
      setAuthSession((current) => {
        if (!current) {
          return current;
        }

        if (isSessionExpired(current.expiresAt)) {
          clearStoredAuthSession();
          setAuthNotice('Session expired. Please sign in again.');
          return undefined;
        }

        return current;
      });
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleExpired = () => {
      clearStoredAuthSession();
      setAuthSession(undefined);
      setAuthNotice('Session expired. Please sign in again.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  const handleLoggedIn = (session: AuthSessionRecord) => {
    persistAuthSession(session);
    setAuthSession(session);
    setAuthNotice('');
  };

  const handleSignOut = () => {
    clearStoredAuthSession();
    setAuthSession(undefined);
    setAuthNotice('Signed out.');
  };

  useEffect(() => {
    if (!authSession) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await runtimeApiClient.getProjects();
        if (!active) {
          return;
        }
        setProjects(response.projects);

        const storedProjectId = readStoredProjectId();
        const projectId =
          (storedProjectId && response.projects.some((project) => project.projectId === storedProjectId)
            ? storedProjectId
            : response.projects[0]?.projectId) ?? '';

        if (projectId) {
          persistProjectId(projectId);
        }
        setSelectedProjectId(projectId);
      } catch {
        if (!active) {
          return;
        }
        setProjects([]);
        setSelectedProjectId('');
      }
    })();

    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectBranches(null);
      setSelectedBranch('all');
      return;
    }

    let active = true;
    void (async () => {
      try {
        const response = await runtimeApiClient.getProjectBranches(selectedProjectId);
        if (!active) {
          return;
        }
        setProjectBranches(response);
        const storedBranch = readStoredProjectBranch(selectedProjectId);
        const options = new Set<string>([
          'all',
          response.defaultBranch,
          ...response.activeRunBranches,
          ...response.integrationBranches,
          ...response.releaseBranches
        ]);
        const branch = storedBranch && options.has(storedBranch) ? storedBranch : 'all';
        setSelectedBranch(branch);
      } catch {
        if (!active) {
          return;
        }
        setProjectBranches(null);
        setSelectedBranch('all');
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedProjectId]);

  if (!authSession) {
    return <LoginScreen notice={authNotice} onLoggedIn={handleLoggedIn} />;
  }

  if (!selectedProjectId) {
    return (
      <main className="layout">
        <header>
          <h1>Spec-MAS Dashboard</h1>
          <p>Loading projects...</p>
        </header>
      </main>
    );
  }

  const selectedProject = projects.find((project) => project.projectId === selectedProjectId);
  const navRoutes = canWriteSessions(authSession.role)
    ? materializeRoutes(createRouteSkeleton(), 'run-2', selectedProjectId || 'alpha')
    : materializeRoutes(createRouteSkeleton(), 'run-2', selectedProjectId || 'alpha').filter(
        (route) => route.key !== 'authoring'
      );

  const availableBranches = projectBranches
    ? ['all', projectBranches.defaultBranch, ...projectBranches.activeRunBranches, ...projectBranches.integrationBranches, ...projectBranches.releaseBranches]
    : ['all'];

  return (
    <main className="layout">
      <header>
        <h1>Spec-MAS Dashboard</h1>
        <p>
          API: {API_BASE_URL} | Health: <strong>{dashboardState.apiHealthy ? 'healthy' : 'unhealthy'}</strong>
        </p>
        <p>
          User: <strong>{authSession.displayName}</strong> ({authSession.role}) | Expires: {authSession.expiresAt}
        </p>
        <p>
          Project: <strong>{(selectedProject?.name ?? selectedProjectId) || 'none'}</strong> | Repo:{' '}
          <strong>{selectedProject?.repoUrl ?? '-'}</strong> | Default branch:{' '}
          <strong>{selectedProject?.defaultBranch ?? '-'}</strong>
        </p>
        <label>
          Project/Repo
          <select
            value={selectedProjectId}
            onChange={(event) => {
              const projectId = event.target.value;
              setSelectedProjectId(projectId);
              persistProjectId(projectId);
              navigate(`/projects/${projectId}/runs`);
            }}
          >
            {projects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.name} ({project.repoUrl})
              </option>
            ))}
          </select>
        </label>
        <label>
          Branch
          <select
            value={selectedBranch}
            onChange={(event) => {
              const branch = event.target.value;
              setSelectedBranch(branch);
              if (selectedProjectId) {
                persistProjectBranch(selectedProjectId, branch);
              }
            }}
          >
            {availableBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        <p>Last check: {dashboardState.lastHealthCheckAt ?? 'never'}</p>
        <button type="button" onClick={() => void refreshHealth()}>
          Refresh Health
        </button>
        <button type="button" onClick={handleSignOut}>
          Sign Out
        </button>
      </header>

      <nav>
        {navRoutes.map((route) => (
          <Link key={route.key} to={route.path}>
            {route.title}
          </Link>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to={`/projects/${selectedProjectId || 'alpha'}/runs`} replace />} />
        <Route
          path="/projects/:projectId/runs"
          element={<RunsRoute selectedBranch={selectedBranch} />}
        />
        <Route path="/projects/:projectId/runs/:runId" element={<RunDetailPage role={authSession.role} />} />
        <Route path="/projects/:projectId/runs/:runId/artifacts" element={<ArtifactsPage />} />
        <Route path="/projects/:projectId/runs/:runId/logs" element={<LogStreamPage />} />
        <Route path="/runs" element={<Navigate to={`/projects/${selectedProjectId || 'alpha'}/runs`} replace />} />
        <Route
          path="/runs/:runId"
          element={<LegacyRunRedirect selectedProjectId={selectedProjectId || 'alpha'} suffix="" />}
        />
        <Route
          path="/runs/:runId/artifacts"
          element={<LegacyRunRedirect selectedProjectId={selectedProjectId || 'alpha'} suffix="/artifacts" />}
        />
        <Route
          path="/runs/:runId/logs"
          element={<LegacyRunRedirect selectedProjectId={selectedProjectId || 'alpha'} suffix="/logs" />}
        />
        <Route path="/authoring" element={<AuthoringPage role={authSession.role} />} />
        <Route path="*" element={<Navigate to={`/projects/${selectedProjectId || 'alpha'}/runs`} replace />} />
      </Routes>
    </main>
  );
}
