import {
  CreatePhaseInput,
  CreateRunInput,
  CreateTaskInput,
  PhaseRecord,
  PhaseStatus,
  RunRecord,
  RunStatus,
  TaskRecord,
  TaskStatus
} from './domain.js';
import { assertPhaseTransition, assertRunTransition, assertTaskTransition } from './stateTransitions.js';

export interface RunRepository {
  createRun(input: CreateRunInput): RunRecord;
  getRun(runId: string): RunRecord | undefined;
  updateRunStatus(runId: string, nextStatus: RunStatus): RunRecord;
  listRunsByProject(projectId: string): RunRecord[];
}

export interface PhaseRepository {
  createPhase(input: CreatePhaseInput): PhaseRecord;
  getPhase(phaseId: string): PhaseRecord | undefined;
  updatePhaseStatus(phaseId: string, nextStatus: PhaseStatus): PhaseRecord;
  listPhasesByRun(runId: string): PhaseRecord[];
}

export interface TaskRepository {
  createTask(input: CreateTaskInput): TaskRecord;
  getTask(taskId: string): TaskRecord | undefined;
  updateTaskStatus(taskId: string, nextStatus: TaskStatus): TaskRecord;
  listTasksByPhase(phaseId: string): TaskRecord[];
}

function sortByCreatedAtThenId<T extends { createdAt: Date; id: string }>(left: T, right: T): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

function cloneRun(run: RunRecord): RunRecord {
  return {
    ...run,
    startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
    completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    createdAt: new Date(run.createdAt),
    updatedAt: new Date(run.updatedAt)
  };
}

function clonePhase(phase: PhaseRecord): PhaseRecord {
  return {
    ...phase,
    startedAt: phase.startedAt ? new Date(phase.startedAt) : undefined,
    completedAt: phase.completedAt ? new Date(phase.completedAt) : undefined,
    createdAt: new Date(phase.createdAt),
    updatedAt: new Date(phase.updatedAt)
  };
}

function cloneTask(task: TaskRecord): TaskRecord {
  return {
    ...task,
    startedAt: task.startedAt ? new Date(task.startedAt) : undefined,
    completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt)
  };
}

function resolveStartedAt<TStatus extends string>(
  previousStartedAt: Date | undefined,
  nextStatus: TStatus,
  runningStatus: TStatus,
  now: Date
): Date | undefined {
  if (nextStatus === runningStatus) {
    return previousStartedAt ?? now;
  }
  return previousStartedAt;
}

function resolveCompletedAt<TStatus extends string>(
  previousCompletedAt: Date | undefined,
  nextStatus: TStatus,
  terminalStatuses: readonly TStatus[],
  resetStatus: TStatus,
  now: Date
): Date | undefined {
  if (nextStatus === resetStatus) {
    return undefined;
  }
  if (terminalStatuses.includes(nextStatus)) {
    return now;
  }
  return previousCompletedAt;
}

export class InMemoryRunStateRepository implements RunRepository, PhaseRepository, TaskRepository {
  private readonly runs = new Map<string, RunRecord>();
  private readonly phases = new Map<string, PhaseRecord>();
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  createRun(input: CreateRunInput): RunRecord {
    if (this.runs.has(input.id)) {
      throw new Error(`Run already exists: ${input.id}`);
    }

    const timestamp = this.now();
    const run: RunRecord = {
      id: input.id,
      projectId: input.projectId,
      specId: input.specId,
      workflowId: input.workflowId,
      status: input.status ?? RunStatus.Pending,
      initiatedBy: input.initiatedBy,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.runs.set(run.id, run);
    return cloneRun(run);
  }

  getRun(runId: string): RunRecord | undefined {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : undefined;
  }

  updateRunStatus(runId: string, nextStatus: RunStatus): RunRecord {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    assertRunTransition(run.status, nextStatus);

    const now = this.now();
    const updated: RunRecord = {
      ...run,
      status: nextStatus,
      startedAt: resolveStartedAt(run.startedAt, nextStatus, RunStatus.Running, now),
      completedAt: resolveCompletedAt(
        run.completedAt,
        nextStatus,
        [RunStatus.Completed, RunStatus.Failed, RunStatus.Cancelled],
        RunStatus.Pending,
        now
      ),
      updatedAt: now
    };

    this.runs.set(runId, updated);
    return cloneRun(updated);
  }

  listRunsByProject(projectId: string): RunRecord[] {
    return Array.from(this.runs.values())
      .filter((run) => run.projectId === projectId)
      .sort(sortByCreatedAtThenId)
      .map((run) => cloneRun(run));
  }

  createPhase(input: CreatePhaseInput): PhaseRecord {
    if (this.phases.has(input.id)) {
      throw new Error(`Phase already exists: ${input.id}`);
    }
    if (!this.runs.has(input.runId)) {
      throw new Error(`Run not found: ${input.runId}`);
    }

    const timestamp = this.now();
    const phase: PhaseRecord = {
      id: input.id,
      runId: input.runId,
      name: input.name,
      status: input.status ?? PhaseStatus.Pending,
      agentId: input.agentId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.phases.set(phase.id, phase);
    return clonePhase(phase);
  }

  getPhase(phaseId: string): PhaseRecord | undefined {
    const phase = this.phases.get(phaseId);
    return phase ? clonePhase(phase) : undefined;
  }

  updatePhaseStatus(phaseId: string, nextStatus: PhaseStatus): PhaseRecord {
    const phase = this.phases.get(phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${phaseId}`);
    }
    assertPhaseTransition(phase.status, nextStatus);

    const now = this.now();
    const updated: PhaseRecord = {
      ...phase,
      status: nextStatus,
      startedAt: resolveStartedAt(phase.startedAt, nextStatus, PhaseStatus.Running, now),
      completedAt: resolveCompletedAt(
        phase.completedAt,
        nextStatus,
        [PhaseStatus.Completed, PhaseStatus.Failed, PhaseStatus.Cancelled],
        PhaseStatus.Pending,
        now
      ),
      updatedAt: now
    };

    this.phases.set(phaseId, updated);
    return clonePhase(updated);
  }

  listPhasesByRun(runId: string): PhaseRecord[] {
    return Array.from(this.phases.values())
      .filter((phase) => phase.runId === runId)
      .sort(sortByCreatedAtThenId)
      .map((phase) => clonePhase(phase));
  }

  createTask(input: CreateTaskInput): TaskRecord {
    if (this.tasks.has(input.id)) {
      throw new Error(`Task already exists: ${input.id}`);
    }

    const run = this.runs.get(input.runId);
    if (!run) {
      throw new Error(`Run not found: ${input.runId}`);
    }

    const phase = this.phases.get(input.phaseId);
    if (!phase) {
      throw new Error(`Phase not found: ${input.phaseId}`);
    }

    if (phase.runId !== run.id) {
      throw new Error(`Phase ${input.phaseId} does not belong to run ${input.runId}`);
    }

    const timestamp = this.now();
    const task: TaskRecord = {
      id: input.id,
      runId: input.runId,
      phaseId: input.phaseId,
      status: input.status ?? TaskStatus.Pending,
      githubIssueNumber: input.githubIssueNumber,
      githubIssueUrl: input.githubIssueUrl,
      specSection: input.specSection,
      agentId: input.agentId,
      retryCount: 0,
      restartCount: 0,
      branchName: input.branchName,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.tasks.set(task.id, task);
    return cloneTask(task);
  }

  getTask(taskId: string): TaskRecord | undefined {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : undefined;
  }

  updateTaskStatus(taskId: string, nextStatus: TaskStatus): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    assertTaskTransition(task.status, nextStatus);

    const now = this.now();
    const updated: TaskRecord = {
      ...task,
      status: nextStatus,
      startedAt: resolveStartedAt(task.startedAt, nextStatus, TaskStatus.Running, now),
      completedAt: resolveCompletedAt(
        task.completedAt,
        nextStatus,
        [TaskStatus.Completed, TaskStatus.Failed, TaskStatus.Cancelled],
        TaskStatus.Pending,
        now
      ),
      updatedAt: now
    };

    this.tasks.set(taskId, updated);
    return cloneTask(updated);
  }

  listTasksByPhase(phaseId: string): TaskRecord[] {
    return Array.from(this.tasks.values())
      .filter((task) => task.phaseId === phaseId)
      .sort(sortByCreatedAtThenId)
      .map((task) => cloneTask(task));
  }
}

export class RunStateRepository extends InMemoryRunStateRepository {}
