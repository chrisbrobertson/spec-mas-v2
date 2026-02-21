export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type LogLevel = 'info' | 'warn' | 'error';

export interface RunRecord {
  id: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
}

export interface PhaseRecord {
  id: string;
  runId: string;
  name: string;
  status: PhaseStatus;
  sequence: number;
}

export interface LogEntry {
  runId: string;
  sequence: number;
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface ArtifactPayload {
  runId: string;
  paths: string[];
  contents: Record<string, string>;
}

const RUNS: RunRecord[] = [
  {
    id: 'run-2',
    projectId: 'alpha',
    status: 'running',
    startedAt: '2026-02-20T00:00:00.000Z'
  },
  {
    id: 'run-1',
    projectId: 'alpha',
    status: 'passed',
    startedAt: '2026-02-19T00:00:00.000Z'
  }
];

const PHASES: PhaseRecord[] = [
  {
    id: 'phase-1',
    runId: 'run-2',
    name: 'Implement',
    status: 'running',
    sequence: 1
  },
  {
    id: 'phase-2',
    runId: 'run-2',
    name: 'Test',
    status: 'pending',
    sequence: 2
  },
  {
    id: 'phase-3',
    runId: 'run-1',
    name: 'Implement',
    status: 'passed',
    sequence: 1
  },
  {
    id: 'phase-4',
    runId: 'run-1',
    name: 'Test',
    status: 'passed',
    sequence: 2
  }
];

const LOGS: LogEntry[] = [
  {
    runId: 'run-2',
    sequence: 1,
    timestamp: '2026-02-20T00:00:01.000Z',
    message: 'run started',
    level: 'info'
  },
  {
    runId: 'run-2',
    sequence: 2,
    timestamp: '2026-02-20T00:00:02.000Z',
    message: 'phase implement in progress',
    level: 'warn'
  },
  {
    runId: 'run-2',
    sequence: 3,
    timestamp: '2026-02-20T00:00:03.000Z',
    message: 'tests queued',
    level: 'info'
  }
];

const ARTIFACTS_BY_RUN_ID: Record<string, ArtifactPayload> = {
  'run-1': {
    runId: 'run-1',
    paths: ['run-summary.md'],
    contents: {
      'run-summary.md': '# Run Summary'
    }
  },
  'run-2': {
    runId: 'run-2',
    paths: ['validation/gate-results.json', 'run-summary.md', 'phases/test/coverage-report.html'],
    contents: {
      'validation/gate-results.json': JSON.stringify({ gates: ['G1', 'G2'], status: 'ok' }),
      'run-summary.md': '# Run Summary',
      'phases/test/coverage-report.html': '<html><head><title>Coverage</title></head><body>ok</body></html>'
    }
  }
};

function copyRun(run: RunRecord): RunRecord {
  return { ...run };
}

function copyPhase(phase: PhaseRecord): PhaseRecord {
  return { ...phase };
}

function copyLog(log: LogEntry): LogEntry {
  return { ...log };
}

export function listRuns(): RunRecord[] {
  return RUNS.map(copyRun);
}

export function loadRun(runId: string): RunRecord | undefined {
  const run = RUNS.find((candidate) => candidate.id === runId);
  return run ? copyRun(run) : undefined;
}

export function loadRunPhases(runId: string): PhaseRecord[] {
  return PHASES.filter((phase) => phase.runId === runId).map(copyPhase);
}

export function loadRunLogs(runId: string): LogEntry[] {
  return LOGS.filter((log) => log.runId === runId).map(copyLog);
}

export function loadRunLogsAfter(runId: string, afterSequence: number): LogEntry[] {
  return LOGS.filter((log) => log.runId === runId && log.sequence > afterSequence).map(copyLog);
}

export function loadRunArtifacts(runId: string): ArtifactPayload | undefined {
  const payload = ARTIFACTS_BY_RUN_ID[runId];
  if (!payload) {
    return undefined;
  }

  return {
    runId: payload.runId,
    paths: [...payload.paths],
    contents: { ...payload.contents }
  };
}
