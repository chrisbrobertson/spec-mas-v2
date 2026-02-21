import { PhaseStatus, RunStatus, TaskStatus } from './domain.js';

type TransitionTable<TState extends string> = Readonly<Record<TState, readonly TState[]>>;

export const RUN_TRANSITIONS: TransitionTable<RunStatus> = {
  [RunStatus.Pending]: [RunStatus.Running, RunStatus.Cancelled],
  [RunStatus.Running]: [RunStatus.Completed, RunStatus.Failed, RunStatus.Paused, RunStatus.Cancelled],
  [RunStatus.Completed]: [],
  [RunStatus.Failed]: [RunStatus.Pending],
  [RunStatus.Paused]: [RunStatus.Running, RunStatus.Cancelled],
  [RunStatus.Cancelled]: [RunStatus.Pending]
};

export const PHASE_TRANSITIONS: TransitionTable<PhaseStatus> = {
  [PhaseStatus.Pending]: [PhaseStatus.Running, PhaseStatus.Skipped, PhaseStatus.Cancelled],
  [PhaseStatus.Running]: [PhaseStatus.Completed, PhaseStatus.Failed, PhaseStatus.Cancelled],
  [PhaseStatus.Completed]: [],
  [PhaseStatus.Failed]: [PhaseStatus.Pending],
  [PhaseStatus.Skipped]: [PhaseStatus.Pending],
  [PhaseStatus.Cancelled]: [PhaseStatus.Pending]
};

export const TASK_TRANSITIONS: TransitionTable<TaskStatus> = {
  [TaskStatus.Pending]: [TaskStatus.Running, TaskStatus.Blocked, TaskStatus.Cancelled],
  [TaskStatus.Running]: [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Blocked, TaskStatus.Cancelled],
  [TaskStatus.Completed]: [],
  [TaskStatus.Failed]: [TaskStatus.Pending, TaskStatus.Cancelled],
  [TaskStatus.Blocked]: [TaskStatus.Pending, TaskStatus.Running, TaskStatus.Cancelled],
  [TaskStatus.Cancelled]: [TaskStatus.Pending]
};

function isAllowedTransition<TState extends string>(
  table: TransitionTable<TState>,
  current: TState,
  next: TState
): boolean {
  return (table[current] ?? []).includes(next);
}

function assertTransition<TState extends string>(
  name: string,
  table: TransitionTable<TState>,
  current: TState,
  next: TState
): void {
  if (!isAllowedTransition(table, current, next)) {
    throw new Error(`Illegal ${name} transition: ${current} -> ${next}`);
  }
}

export function isRunTransitionAllowed(current: RunStatus, next: RunStatus): boolean {
  return isAllowedTransition(RUN_TRANSITIONS, current, next);
}

export function isPhaseTransitionAllowed(current: PhaseStatus, next: PhaseStatus): boolean {
  return isAllowedTransition(PHASE_TRANSITIONS, current, next);
}

export function isTaskTransitionAllowed(current: TaskStatus, next: TaskStatus): boolean {
  return isAllowedTransition(TASK_TRANSITIONS, current, next);
}

export function assertRunTransition(current: RunStatus, next: RunStatus): void {
  assertTransition('run', RUN_TRANSITIONS, current, next);
}

export function assertPhaseTransition(current: PhaseStatus, next: PhaseStatus): void {
  assertTransition('phase', PHASE_TRANSITIONS, current, next);
}

export function assertTaskTransition(current: TaskStatus, next: TaskStatus): void {
  assertTransition('task', TASK_TRANSITIONS, current, next);
}
