import type { WorkflowDefinition, WorkflowPhaseMode } from './schema.js';
import type { MergeApprovalStatus } from './gates.js';

export interface TaskRunnerResult {
  ok: boolean;
  output: string;
  error?: string;
}

export interface WorkflowTaskRunner {
  runTask(taskId: string): Promise<TaskRunnerResult>;
}

export interface TaskExecutionResult {
  taskId: string;
  status: 'passed' | 'failed';
  output: string;
  error?: string;
}

export interface PhaseExecutionResult {
  phaseId: string;
  mode: WorkflowPhaseMode;
  status: 'passed' | 'failed';
  tasks: TaskExecutionResult[];
}

export interface WorkflowExecutionResult {
  workflowName: string;
  status: 'passed' | 'failed';
  phases: PhaseExecutionResult[];
}

export function assertMergeReady(status: MergeApprovalStatus): void {
  if (status !== 'approved') {
    throw new Error(`merge blocked: status is ${status}`);
  }
}

async function executeTask(taskId: string, runner: WorkflowTaskRunner): Promise<TaskExecutionResult> {
  const result = await runner.runTask(taskId);
  return {
    taskId,
    status: result.ok ? 'passed' : 'failed',
    output: result.output,
    error: result.error
  };
}

async function runSequentialTasks(
  taskIds: readonly string[],
  runner: WorkflowTaskRunner
): Promise<TaskExecutionResult[]> {
  const results: TaskExecutionResult[] = [];
  for (const taskId of taskIds) {
    const result = await executeTask(taskId, runner);
    results.push(result);
  }
  return results;
}

function phaseStatus(taskResults: readonly TaskExecutionResult[]): 'passed' | 'failed' {
  return taskResults.every((task) => task.status === 'passed') ? 'passed' : 'failed';
}

export async function executeWorkflow(
  workflow: WorkflowDefinition,
  runner: WorkflowTaskRunner
): Promise<WorkflowExecutionResult> {
  const phases: PhaseExecutionResult[] = [];
  let workflowStatus: 'passed' | 'failed' = 'passed';

  for (const phase of workflow.phases) {
    const tasks =
      phase.mode === 'parallel'
        ? await Promise.all(phase.tasks.map((taskId) => executeTask(taskId, runner)))
        : await runSequentialTasks(phase.tasks, runner);

    const status = phaseStatus(tasks);
    phases.push({
      phaseId: phase.id,
      mode: phase.mode,
      status,
      tasks
    });

    if (status === 'failed') {
      workflowStatus = 'failed';
      break;
    }
  }

  return {
    workflowName: workflow.name,
    status: workflowStatus,
    phases
  };
}
