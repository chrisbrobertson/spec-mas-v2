import { createDashboardShell, createDeterministicDashboardClock } from '/dist/src/app.js';
import { buildRunDetailView, buildRunListView } from '/dist/src/runViews.js';
import { buildArtifactTree, renderArtifactPreview } from '/dist/src/artifactExplorer.js';
import { LiveLogStreamModel } from '/dist/src/logStream.js';
import {
  accessibleSections,
  createAuthoringFlowState,
  editSection,
  submitGuidedAnswer,
  switchAuthoringMode
} from '/dist/src/authoringFlow.js';

const dashboardRoot = document.querySelector('#dashboard');
const runsRoot = document.querySelector('#runs');
const artifactsRoot = document.querySelector('#artifacts');
const logsRoot = document.querySelector('#logs');
const authoringRoot = document.querySelector('#authoring');

if (!dashboardRoot || !runsRoot || !artifactsRoot || !logsRoot || !authoringRoot) {
  throw new Error('Harness sections missing');
}

const healthClock = createDeterministicDashboardClock('2026-02-19T00:00:00.000Z', 1_000);
const dashboardClients = {
  healthy: { ping: async () => ({ status: 'ok' }) },
  degraded: { ping: async () => ({ status: 'degraded' }) },
  error: { ping: async () => { throw new Error('offline'); } }
};
const dashboardShells = {
  healthy: createDashboardShell(dashboardClients.healthy, healthClock),
  degraded: createDashboardShell(dashboardClients.degraded, healthClock),
  error: createDashboardShell(dashboardClients.error, healthClock)
};
let dashboardState = dashboardShells.healthy.getState();

let runError = '';
let runList = [];
let runDetail = null;

let artifactTree = buildArtifactTree([]);
let artifactPreview = { renderer: 'text', summary: '0 characters' };

const logModel = new LiveLogStreamModel();
let logError = '';

let authoringState = createAuthoringFlowState('guided');
let authoringError = '';

function text(value) {
  return value == null ? '' : String(value);
}

function renderDashboard() {
  dashboardRoot.innerHTML = `
    <h2>Dashboard Shell</h2>
    <button data-testid="dashboard-load-healthy">Load Healthy</button>
    <button data-testid="dashboard-load-degraded">Load Degraded</button>
    <button data-testid="dashboard-load-error">Load Error</button>
    <div><span class="label">Status:</span> <span data-testid="dashboard-status">${dashboardState.apiHealthy ? 'healthy' : 'unhealthy'}</span></div>
    <div><span class="label">Last Check:</span> <span data-testid="dashboard-timestamp">${text(dashboardState.lastHealthCheckAt)}</span></div>
    <div><span class="label">Route Count:</span> <span data-testid="dashboard-route-count">${dashboardState.routes.length}</span></div>
  `;

  dashboardRoot.querySelector('[data-testid="dashboard-load-healthy"]')?.addEventListener('click', async () => {
    dashboardState = await dashboardShells.healthy.load();
    renderDashboard();
  });
  dashboardRoot.querySelector('[data-testid="dashboard-load-degraded"]')?.addEventListener('click', async () => {
    dashboardState = await dashboardShells.degraded.load();
    renderDashboard();
  });
  dashboardRoot.querySelector('[data-testid="dashboard-load-error"]')?.addEventListener('click', async () => {
    dashboardState = await dashboardShells.error.load();
    renderDashboard();
  });
}

function renderRuns() {
  const listMarkup = runList.map((item) => `<li data-testid="run-item">${item.id}:${item.badge.label}</li>`).join('');
  const timelineMarkup = runDetail
    ? runDetail.timeline.map((item) => `<li data-testid="phase-item">${item.sequence}:${item.phaseId}:${item.badge.label}</li>`).join('')
    : '';

  runsRoot.innerHTML = `
    <h2>Run Views</h2>
    <button data-testid="runs-render-core">Render Core</button>
    <button data-testid="runs-render-duplicate">Render Duplicate Error</button>
    <div><span class="label">Error:</span> <span data-testid="runs-error">${runError}</span></div>
    <div><span class="label">List:</span></div>
    <ul data-testid="run-list">${listMarkup}</ul>
    <div><span class="label">Timeline:</span></div>
    <ul data-testid="run-timeline">${timelineMarkup}</ul>
    <div data-testid="run-phase-counts">${runDetail ? JSON.stringify(runDetail.phaseCounts) : ''}</div>
  `;

  runsRoot.querySelector('[data-testid="runs-render-core"]')?.addEventListener('click', () => {
    runError = '';
    const runs = [
      { id: 'run-2', projectId: 'alpha', status: 'running', startedAt: '2026-02-20T00:00:00.000Z' },
      { id: 'run-1', projectId: 'alpha', status: 'passed', startedAt: '2026-02-19T00:00:00.000Z' }
    ];
    const phases = [
      { id: 'ph-2', runId: 'run-2', name: 'test', status: 'pending', sequence: 2 },
      { id: 'ph-1', runId: 'run-2', name: 'implement', status: 'running', sequence: 1 }
    ];
    runList = buildRunListView(runs);
    runDetail = buildRunDetailView(runs[0], phases);
    renderRuns();
  });

  runsRoot.querySelector('[data-testid="runs-render-duplicate"]')?.addEventListener('click', () => {
    runError = '';
    try {
      const run = { id: 'run-1', projectId: 'alpha', status: 'running', startedAt: '2026-02-20T00:00:00.000Z' };
      const phases = [
        { id: 'ph-1', runId: 'run-1', name: 'implement', status: 'running', sequence: 1 },
        { id: 'ph-2', runId: 'run-1', name: 'test', status: 'pending', sequence: 1 }
      ];
      runDetail = buildRunDetailView(run, phases);
    } catch (error) {
      runError = error instanceof Error ? error.message : 'unknown error';
    }
    renderRuns();
  });
}

function renderArtifacts() {
  artifactsRoot.innerHTML = `
    <h2>Artifact Explorer</h2>
    <button data-testid="artifacts-valid">Valid Data</button>
    <button data-testid="artifacts-invalid">Invalid JSON</button>
    <button data-testid="artifacts-empty">Empty Paths</button>
    <div data-testid="artifacts-root-children">${artifactTree.children.map((node) => node.name).join(',')}</div>
    <div data-testid="artifacts-renderer">${artifactPreview.renderer}</div>
    <div data-testid="artifacts-summary">${artifactPreview.summary}</div>
  `;

  artifactsRoot.querySelector('[data-testid="artifacts-valid"]')?.addEventListener('click', () => {
    artifactTree = buildArtifactTree([
      'validation/gate-results.json',
      'run-summary.md',
      'phases/test/coverage-report.html'
    ]);
    artifactPreview = renderArtifactPreview('validation/gate-results.json', '{"status":"ok","gates":["G1","G2"]}');
    renderArtifacts();
  });

  artifactsRoot.querySelector('[data-testid="artifacts-invalid"]')?.addEventListener('click', () => {
    artifactPreview = renderArtifactPreview('validation/gate-results.json', '{broken');
    renderArtifacts();
  });

  artifactsRoot.querySelector('[data-testid="artifacts-empty"]')?.addEventListener('click', () => {
    artifactTree = buildArtifactTree(['', '   ']);
    artifactPreview = renderArtifactPreview('run-summary.md', '# Summary');
    renderArtifacts();
  });
}

function renderLogs() {
  const snapshot = logModel.snapshot();
  logsRoot.innerHTML = `
    <h2>Live Log Stream</h2>
    <button data-testid="logs-connect">Connect</button>
    <button data-testid="logs-seed">Seed Logs</button>
    <button data-testid="logs-disconnect">Disconnect</button>
    <button data-testid="logs-reconnect">Reconnect</button>
    <button data-testid="logs-invalid">Invalid Sequence</button>
    <div data-testid="logs-connected">${snapshot.connected}</div>
    <div data-testid="logs-reconnect-count">${snapshot.reconnectCount}</div>
    <div data-testid="logs-last-sequence">${snapshot.lastSequence}</div>
    <div data-testid="logs-sequences">${snapshot.logs.map((entry) => entry.sequence).join(',')}</div>
    <div data-testid="logs-timeline">${snapshot.timeline.map((entry) => entry.type).join(',')}</div>
    <div data-testid="logs-error">${logError}</div>
  `;

  logsRoot.querySelector('[data-testid="logs-connect"]')?.addEventListener('click', () => {
    logError = '';
    logModel.connect('2026-02-19T10:00:00.000Z');
    renderLogs();
  });

  logsRoot.querySelector('[data-testid="logs-seed"]')?.addEventListener('click', () => {
    logError = '';
    logModel.receive({
      runId: 'run-1',
      sequence: 2,
      timestamp: '2026-02-19T10:00:02.000Z',
      message: 'second',
      level: 'info'
    });
    logModel.receive({
      runId: 'run-1',
      sequence: 1,
      timestamp: '2026-02-19T10:00:01.000Z',
      message: 'first',
      level: 'info'
    });
    logModel.receive({
      runId: 'run-1',
      sequence: 3,
      timestamp: '2026-02-19T10:00:03.000Z',
      message: 'third',
      level: 'warn'
    });
    renderLogs();
  });

  logsRoot.querySelector('[data-testid="logs-disconnect"]')?.addEventListener('click', () => {
    logError = '';
    logModel.disconnect('2026-02-19T10:00:04.000Z', 'network issue');
    renderLogs();
  });

  logsRoot.querySelector('[data-testid="logs-reconnect"]')?.addEventListener('click', () => {
    logError = '';
    logModel.reconnect('2026-02-19T10:00:05.000Z');
    renderLogs();
  });

  logsRoot.querySelector('[data-testid="logs-invalid"]')?.addEventListener('click', () => {
    logError = '';
    try {
      logModel.receive({
        runId: 'run-1',
        sequence: 0,
        timestamp: '2026-02-19T10:00:06.000Z',
        message: 'invalid',
        level: 'error'
      });
    } catch (error) {
      logError = error instanceof Error ? error.message : 'unknown error';
    }
    renderLogs();
  });
}

function renderAuthoring() {
  authoringRoot.innerHTML = `
    <h2>Authoring Flow</h2>
    <button data-testid="authoring-reset-guided">Reset Guided</button>
    <button data-testid="authoring-submit-overview">Submit Overview</button>
    <button data-testid="authoring-submit-blank">Submit Blank</button>
    <button data-testid="authoring-switch-edit">Switch Edit</button>
    <button data-testid="authoring-edit-data-model">Edit Data Model</button>
    <button data-testid="authoring-switch-freeform">Switch Freeform</button>
    <button data-testid="authoring-switch-guided">Switch Guided</button>
    <button data-testid="authoring-edit-locked">Edit Locked Section</button>
    <div data-testid="authoring-mode">${authoringState.mode}</div>
    <div data-testid="authoring-active">${text(authoringState.activeSectionId)}</div>
    <div data-testid="authoring-accessible">${accessibleSections(authoringState).join(',')}</div>
    <div data-testid="authoring-completed">${authoringState.sections.filter((section) => section.completed).map((section) => section.id).join(',')}</div>
    <div data-testid="authoring-error">${authoringError}</div>
  `;

  authoringRoot.querySelector('[data-testid="authoring-reset-guided"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = createAuthoringFlowState('guided');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-submit-overview"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = submitGuidedAnswer(authoringState, 'Payment service overview');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-submit-blank"]')?.addEventListener('click', () => {
    authoringError = '';
    try {
      authoringState = submitGuidedAnswer(authoringState, '   ');
    } catch (error) {
      authoringError = error instanceof Error ? error.message : 'unknown error';
    }
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-switch-edit"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = switchAuthoringMode(authoringState, 'edit');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-edit-data-model"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = editSection(authoringState, 'data-model', 'Entity: Payment');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-switch-freeform"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = switchAuthoringMode(authoringState, 'freeform');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-switch-guided"]')?.addEventListener('click', () => {
    authoringError = '';
    authoringState = switchAuthoringMode(authoringState, 'guided');
    renderAuthoring();
  });

  authoringRoot.querySelector('[data-testid="authoring-edit-locked"]')?.addEventListener('click', () => {
    authoringError = '';
    try {
      authoringState = editSection(authoringState, 'acceptance-criteria', 'criteria');
    } catch (error) {
      authoringError = error instanceof Error ? error.message : 'unknown error';
    }
    renderAuthoring();
  });
}

renderDashboard();
renderRuns();
renderArtifacts();
renderLogs();
renderAuthoring();
