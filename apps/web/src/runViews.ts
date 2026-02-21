export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type MergeStatus = 'awaiting_human_approval' | 'approved' | 'rejected' | 'merged';

export interface RunRecord {
  id: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
  sourceBranch: string;
  workingBranch: string;
  integrationBranch: string;
  releaseBranch: string;
  mergeStatus: MergeStatus;
}

export interface PhaseRecord {
  id: string;
  runId: string;
  name: string;
  status: PhaseStatus;
  sequence: number;
}

export interface StatusBadge {
  label: string;
  tone: 'neutral' | 'active' | 'success' | 'danger' | 'muted';
}

export interface RunListItem {
  id: string;
  projectId: string;
  startedAt: string;
  workingBranch: string;
  mergeStatus: MergeStatus;
  badge: StatusBadge;
}

export interface RunDetailView {
  runId: string;
  projectId: string;
  sourceBranch: string;
  workingBranch: string;
  integrationBranch: string;
  releaseBranch: string;
  mergeStatus: MergeStatus;
  badge: StatusBadge;
  timeline: Array<{
    phaseId: string;
    name: string;
    sequence: number;
    status: PhaseStatus;
    badge: StatusBadge;
  }>;
  phaseCounts: Record<PhaseStatus, number>;
}

const RUN_BADGES: Record<RunStatus, StatusBadge> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'active' },
  passed: { label: 'Passed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'muted' }
};

const PHASE_BADGES: Record<PhaseStatus, StatusBadge> = {
  pending: { label: 'Pending', tone: 'neutral' },
  running: { label: 'Running', tone: 'active' },
  passed: { label: 'Passed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'muted' }
};

function compareRuns(left: RunRecord, right: RunRecord): number {
  const byStartedAt = right.startedAt.localeCompare(left.startedAt);
  if (byStartedAt !== 0) {
    return byStartedAt;
  }

  return left.id.localeCompare(right.id);
}

function comparePhases(left: PhaseRecord, right: PhaseRecord): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.id.localeCompare(right.id);
}

export function buildRunListView(runs: RunRecord[]): RunListItem[] {
  return [...runs].sort(compareRuns).map((run) => ({
    id: run.id,
    projectId: run.projectId,
    startedAt: run.startedAt,
    workingBranch: run.workingBranch,
    mergeStatus: run.mergeStatus,
    badge: RUN_BADGES[run.status]
  }));
}

function buildPhaseCounts(phases: PhaseRecord[]): Record<PhaseStatus, number> {
  const counts: Record<PhaseStatus, number> = {
    pending: 0,
    running: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  for (const phase of phases) {
    counts[phase.status] += 1;
  }

  return counts;
}

function assertUniquePhaseSequence(phases: PhaseRecord[]): void {
  const seen = new Set<number>();
  for (const phase of phases) {
    if (seen.has(phase.sequence)) {
      throw new Error(`Duplicate phase sequence: ${phase.sequence}`);
    }
    seen.add(phase.sequence);
  }
}

export function buildRunDetailView(run: RunRecord, phases: PhaseRecord[]): RunDetailView {
  const runPhases = phases.filter((phase) => phase.runId === run.id);
  assertUniquePhaseSequence(runPhases);

  const timeline = runPhases.sort(comparePhases).map((phase) => ({
    phaseId: phase.id,
    name: phase.name,
    sequence: phase.sequence,
    status: phase.status,
    badge: PHASE_BADGES[phase.status]
  }));

  return {
    runId: run.id,
    projectId: run.projectId,
    sourceBranch: run.sourceBranch,
    workingBranch: run.workingBranch,
    integrationBranch: run.integrationBranch,
    releaseBranch: run.releaseBranch,
    mergeStatus: run.mergeStatus,
    badge: RUN_BADGES[run.status],
    timeline,
    phaseCounts: buildPhaseCounts(runPhases)
  };
}

export function filterRunsByProjectAndBranch(
  runs: RunRecord[],
  projectId: string | undefined,
  branch: string | undefined
): RunRecord[] {
  return runs.filter((run) => {
    if (projectId && run.projectId !== projectId) {
      return false;
    }
    if (!branch || branch === 'all') {
      return true;
    }
    return (
      run.sourceBranch === branch ||
      run.workingBranch === branch ||
      run.integrationBranch === branch ||
      run.releaseBranch === branch
    );
  });
}
