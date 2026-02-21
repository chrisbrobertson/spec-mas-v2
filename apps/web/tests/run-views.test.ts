import { describe, expect, it } from 'vitest';
import {
  buildRunDetailView,
  buildRunListView,
  filterRunsByProjectAndBranch,
  type PhaseRecord,
  type RunRecord
} from '../src/runViews.js';

describe('run-views', () => {
  it('builds deterministic run list and detail timeline views', () => {
    const runs: RunRecord[] = [
      {
        id: 'run-2',
        projectId: 'alpha',
        status: 'running',
        startedAt: '2026-02-20T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: 'specmas/run-2/issue-201',
        integrationBranch: 'specmas/run-2/integration',
        releaseBranch: 'specmas/run-2/release',
        mergeStatus: 'awaiting_human_approval'
      },
      {
        id: 'run-1',
        projectId: 'alpha',
        status: 'passed',
        startedAt: '2026-02-19T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: 'specmas/run-1/issue-101',
        integrationBranch: 'specmas/run-1/integration',
        releaseBranch: 'specmas/run-1/release',
        mergeStatus: 'awaiting_human_approval'
      }
    ];

    const list = buildRunListView(runs);
    expect(list.map((item) => item.id)).toEqual(['run-2', 'run-1']);
    expect(list[0].badge).toEqual({ label: 'Running', tone: 'active' });
    expect(list[0].workingBranch).toBe('specmas/run-2/issue-201');

    const phases: PhaseRecord[] = [
      { id: 'ph-2', runId: 'run-2', name: 'test', status: 'pending', sequence: 2 },
      { id: 'ph-1', runId: 'run-2', name: 'implement', status: 'running', sequence: 1 }
    ];
    const detail = buildRunDetailView(runs[0], phases);

    expect(detail.timeline.map((item) => item.phaseId)).toEqual(['ph-1', 'ph-2']);
    expect(detail.phaseCounts).toEqual({
      pending: 1,
      running: 1,
      passed: 0,
      failed: 0,
      skipped: 0
    });
  });

  it('fails when phase sequences are duplicated', () => {
    const run: RunRecord = {
      id: 'run-1',
      projectId: 'alpha',
      status: 'running',
      startedAt: '2026-02-19T00:00:00.000Z',
      sourceBranch: 'main',
      workingBranch: 'specmas/run-1/issue-101',
      integrationBranch: 'specmas/run-1/integration',
      releaseBranch: 'specmas/run-1/release',
      mergeStatus: 'awaiting_human_approval'
    };
    const phases: PhaseRecord[] = [
      { id: 'ph-1', runId: 'run-1', name: 'implement', status: 'running', sequence: 1 },
      { id: 'ph-2', runId: 'run-1', name: 'test', status: 'pending', sequence: 1 }
    ];

    expect(() => buildRunDetailView(run, phases)).toThrow('Duplicate phase sequence: 1');
  });

  it('handles edge case when a run has no phases', () => {
    const run: RunRecord = {
      id: 'run-1',
      projectId: 'alpha',
      status: 'queued',
      startedAt: '2026-02-19T00:00:00.000Z',
      sourceBranch: 'main',
      workingBranch: 'specmas/run-1/issue-101',
      integrationBranch: 'specmas/run-1/integration',
      releaseBranch: 'specmas/run-1/release',
      mergeStatus: 'awaiting_human_approval'
    };

    const detail = buildRunDetailView(run, []);
    expect(detail.timeline).toEqual([]);
    expect(detail.phaseCounts).toEqual({
      pending: 0,
      running: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    });
  });

  it('filters runs by project and branch selectors', () => {
    const runs: RunRecord[] = [
      {
        id: 'run-2',
        projectId: 'alpha',
        status: 'running',
        startedAt: '2026-02-20T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: 'specmas/run-2/issue-201',
        integrationBranch: 'specmas/run-2/integration',
        releaseBranch: 'specmas/run-2/release',
        mergeStatus: 'awaiting_human_approval'
      },
      {
        id: 'run-3',
        projectId: 'beta',
        status: 'passed',
        startedAt: '2026-02-21T00:00:00.000Z',
        sourceBranch: 'develop',
        workingBranch: 'specmas/run-3/issue-300',
        integrationBranch: 'specmas/run-3/integration',
        releaseBranch: 'specmas/run-3/release',
        mergeStatus: 'approved'
      }
    ];

    expect(filterRunsByProjectAndBranch(runs, 'alpha', undefined).map((run) => run.id)).toEqual(['run-2']);
    expect(filterRunsByProjectAndBranch(runs, 'beta', 'specmas/run-3/release').map((run) => run.id)).toEqual([
      'run-3'
    ]);
    expect(filterRunsByProjectAndBranch(runs, undefined, 'all').map((run) => run.id)).toEqual(['run-2', 'run-3']);
  });
});
