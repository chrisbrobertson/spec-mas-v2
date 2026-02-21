import type { PhaseRecord, RunRecord } from '../runViews.js';

export const DEMO_RUNS: RunRecord[] = [
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

export const DEMO_PHASES: PhaseRecord[] = [
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

export const DEMO_ARTIFACT_PATHS = [
  'validation/gate-results.json',
  'run-summary.md',
  'phases/test/coverage-report.html'
];

export const DEMO_ARTIFACT_CONTENT: Record<string, string> = {
  'validation/gate-results.json': JSON.stringify({ gates: ['G1', 'G2'], status: 'ok' }),
  'run-summary.md': '# Run Summary',
  'phases/test/coverage-report.html': '<html><head><title>Coverage</title></head><body>ok</body></html>'
};
