import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaClient, type PhaseStatus, type RunStatus, type TaskStatus } from '@prisma/client';

type WorkflowPhaseMode = 'sequential' | 'parallel';

interface WorkflowPhaseDefinition {
  id: string;
  mode: WorkflowPhaseMode;
  tasks: string[];
  gates: string[];
}

interface WorkflowDefinition {
  name: string;
  phases: WorkflowPhaseDefinition[];
}

interface WorkflowTaskRunner {
  runTask(taskId: string): Promise<{
    ok: boolean;
    output: string;
    error?: string;
  }>;
}

interface WorkflowExecutionResult {
  status: 'passed' | 'failed';
  phases: Array<{
    phaseId: string;
    status: 'passed' | 'failed';
  }>;
}

type ExecuteWorkflow = (
  workflow: WorkflowDefinition,
  runner: WorkflowTaskRunner
) => Promise<WorkflowExecutionResult>;

interface RuntimeExecutionResult {
  sandboxId: string;
  result: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  logs: Array<{ message: string }>;
}

type RunLifecycle = (
  adapter: unknown,
  request: {
    sandboxConfig: {
      image: string;
      workspacePath: string;
      cpuLimit: number;
      memoryMb: number;
      networkEnabled: boolean;
    };
    command: string[];
    env: Record<string, string>;
  }
) => Promise<RuntimeExecutionResult>;

type CreateRuntimeAdapter = () => unknown;

export interface RunStartInput {
  projectId: string;
  specId?: string;
  initiatedBy?: string;
  workflowPhases?: Array<{
    id: string;
    mode?: WorkflowPhaseMode;
    tasks: string[];
  }>;
}

export interface RunControlService {
  startRun(input: RunStartInput): Promise<{ runId: string }>;
  cancelRun(runId: string): Promise<boolean>;
  close?(): Promise<void>;
}

interface TaskBinding {
  taskDbId: string;
  phaseDbId: string;
  phaseKey: string;
  taskLabel: string;
}

interface ActiveRunState {
  cancelled: boolean;
}

interface PrismaRunControlServiceOptions {
  prisma?: PrismaClient;
  now?: () => Date;
}

const EXECUTE_WORKFLOW_MODULES = [
  '../../../packages/workflow/dist/executor.js',
  '../../../packages/workflow/src/executor.js'
] as const;
const RUNTIME_MODULES = [
  '../../../packages/runtime/dist/index.js',
  '../../../packages/runtime/src/index.js'
] as const;
const ARTIFACT_ROOT = resolve(process.cwd(), 'artifacts', 'runs');

function sanitize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+/u, '')
    .replace(/-+$/u, '');
}

async function writeArtifact(runId: string, relativePath: string, content: string): Promise<number> {
  const outputPath = join(ARTIFACT_ROOT, runId, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

function defaultWorkflowPhases(): Array<{
  id: string;
  mode?: WorkflowPhaseMode;
  tasks: string[];
}> {
  return [
    {
      id: 'implement',
      mode: 'sequential',
      tasks: ['implement-task']
    },
    {
      id: 'test',
      mode: 'sequential',
      tasks: ['test-task']
    }
  ];
}

function normalizeWorkflow(input: RunStartInput): WorkflowDefinition {
  const phases = input.workflowPhases ?? defaultWorkflowPhases();
  if (phases.length === 0) {
    throw new Error('workflowPhases must include at least one phase');
  }

  const normalized: WorkflowPhaseDefinition[] = phases.map((phase) => {
    const phaseId = phase.id.trim();
    if (!phaseId) {
      throw new Error('workflow phase id is required');
    }
    if (!phase.tasks || phase.tasks.length === 0) {
      throw new Error(`workflow phase "${phaseId}" must include at least one task`);
    }

    const tasks = phase.tasks.map((task) => {
      const taskId = task.trim();
      if (!taskId) {
        throw new Error(`workflow phase "${phaseId}" includes an empty task id`);
      }
      return taskId;
    });

    return {
      id: phaseId,
      mode: phase.mode ?? 'sequential',
      tasks,
      gates: []
    };
  });

  return {
    name: `${input.projectId}-runtime-workflow`,
    phases: normalized
  };
}

function isTerminalRunStatus(status: RunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function recordError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function importWithFallback<T>(moduleSpecifiers: readonly string[]): Promise<T> {
  let lastError: unknown;
  for (const moduleSpecifier of moduleSpecifiers) {
    try {
      return (await import(moduleSpecifier)) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Unable to import module: ${recordError(lastError)}`);
}

async function loadExecuteWorkflow(): Promise<ExecuteWorkflow> {
  const loaded = await importWithFallback<Record<string, unknown>>(EXECUTE_WORKFLOW_MODULES);
  const candidate = loaded.executeWorkflow;
  if (typeof candidate !== 'function') {
    throw new Error('workflow executor export executeWorkflow is unavailable');
  }
  return candidate as ExecuteWorkflow;
}

async function loadRuntimeHelpers(): Promise<{
  createRuntimeAdapter: CreateRuntimeAdapter;
  runLifecycle: RunLifecycle;
}> {
  const loaded = await importWithFallback<Record<string, unknown>>(RUNTIME_MODULES);
  const createRuntimeAdapter = loaded.createLocalDockerOpenHandsRuntimeAdapter;
  const runLifecycle = loaded.runLifecycle;

  if (typeof createRuntimeAdapter !== 'function') {
    throw new Error('runtime adapter export createLocalDockerOpenHandsRuntimeAdapter is unavailable');
  }
  if (typeof runLifecycle !== 'function') {
    throw new Error('runtime lifecycle export runLifecycle is unavailable');
  }

  return {
    createRuntimeAdapter: createRuntimeAdapter as CreateRuntimeAdapter,
    runLifecycle: runLifecycle as RunLifecycle
  };
}

export class PrismaRunControlService implements RunControlService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;
  private readonly activeRuns = new Map<string, ActiveRunState>();

  constructor(options: PrismaRunControlServiceOptions = {}) {
    this.prisma = options.prisma ?? new PrismaClient();
    this.now = options.now ?? (() => new Date());
  }

  async startRun(input: RunStartInput): Promise<{ runId: string }> {
    const projectName = input.projectId.trim();
    if (!projectName) {
      throw new Error('projectId is required');
    }

    const workflow = normalizeWorkflow(input);
    const project = await this.ensureProject(projectName);
    const startedAt = this.now();

    const run = await this.prisma.run.create({
      data: {
        projectId: project.id,
        status: 'running',
        startedAt,
        initiatedBy: input.initiatedBy ?? 'api',
        specId: input.specId,
        artifactPath: `artifacts/runs/${runIdHint(projectName, startedAt)}`
      }
    });

    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        artifactPath: `artifacts/runs/${run.id}`
      }
    });

    const taskBindings = await this.createRunStructure(run.id, workflow);
    const state: ActiveRunState = { cancelled: false };
    this.activeRuns.set(run.id, state);

    void this.executeRunLifecycle(run.id, workflow, taskBindings, state);

    return { runId: run.id };
  }

  async cancelRun(runId: string): Promise<boolean> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: { id: true, status: true }
    });
    if (!run) {
      return false;
    }
    if (isTerminalRunStatus(run.status)) {
      return true;
    }

    const state = this.activeRuns.get(runId);
    if (state) {
      state.cancelled = true;
    }

    await this.prisma.$transaction([
      this.prisma.run.update({
        where: { id: runId },
        data: {
          status: 'cancelled',
          completedAt: this.now(),
          errorMessage: 'cancelled by user request'
        }
      }),
      this.prisma.phase.updateMany({
        where: {
          runId,
          status: {
            in: ['pending', 'running'] satisfies PhaseStatus[]
          }
        },
        data: {
          status: 'cancelled',
          completedAt: this.now()
        }
      }),
      this.prisma.task.updateMany({
        where: {
          runId,
          status: {
            in: ['pending', 'running'] satisfies TaskStatus[]
          }
        },
        data: {
          status: 'cancelled',
          completedAt: this.now()
        }
      })
    ]);

    return true;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async ensureProject(projectName: string): Promise<{ id: string }> {
    const existing = await this.prisma.project.findFirst({
      where: {
        name: projectName
      },
      select: {
        id: true
      }
    });
    if (existing) {
      return existing;
    }

    const created = await this.prisma.project.create({
      data: {
        name: projectName,
        repoUrl: `local://${sanitize(projectName) || 'project'}`
      },
      select: {
        id: true
      }
    });
    return created;
  }

  private async createRunStructure(runId: string, workflow: WorkflowDefinition): Promise<Map<string, TaskBinding>> {
    const bindings = new Map<string, TaskBinding>();

    for (const [phaseIndex, phase] of workflow.phases.entries()) {
      const phaseDbId = `${runId}-phase-${phaseIndex + 1}`;
      await this.prisma.phase.create({
        data: {
          id: phaseDbId,
          runId,
          name: phase.id,
          status: 'pending'
        }
      });

      for (const [taskIndex, task] of phase.tasks.entries()) {
        const taskDbId = `${phaseDbId}-task-${taskIndex + 1}`;
        const taskKey = `${phase.id}:${task}`;
        await this.prisma.task.create({
          data: {
            id: taskDbId,
            runId,
            phaseId: phaseDbId,
            status: 'pending',
            specSection: task
          }
        });
        bindings.set(taskKey, {
          taskDbId,
          phaseDbId,
          phaseKey: phase.id,
          taskLabel: task
        });
      }
    }

    return bindings;
  }

  private async executeRunLifecycle(
    runId: string,
    workflow: WorkflowDefinition,
    taskBindings: Map<string, TaskBinding>,
    state: ActiveRunState
  ): Promise<void> {
    try {
      const executeWorkflow = await loadExecuteWorkflow();
      const runtime = await loadRuntimeHelpers();
      const runtimeAdapter = runtime.createRuntimeAdapter();
      const workspacePath = process.env.OPENHANDS_WORKSPACE_PATH ?? process.cwd();
      const image = process.env.OPENHANDS_IMAGE ?? 'nginx:alpine';

      const workflowResult = await executeWorkflow(workflow, {
        runTask: async (taskKey) => {
          const binding = taskBindings.get(taskKey);
          if (!binding) {
            return {
              ok: false,
              output: '',
              error: `Unknown task key: ${taskKey}`
            };
          }

          if (state.cancelled) {
            return {
              ok: false,
              output: JSON.stringify({ cancelled: true, taskKey }),
              error: 'Run cancelled'
            };
          }

          await this.prisma.phase.update({
            where: {
              id: binding.phaseDbId
            },
            data: {
              status: 'running',
              startedAt: this.now()
            }
          });

          await this.prisma.task.update({
            where: {
              id: binding.taskDbId
            },
            data: {
              status: 'running',
              startedAt: this.now()
            }
          });

          try {
            const lifecycle = await runtime.runLifecycle(runtimeAdapter, {
              sandboxConfig: {
                image,
                workspacePath,
                cpuLimit: 1,
                memoryMb: 512,
                networkEnabled: false
              },
              command: [
                '/bin/sh',
                '-lc',
                [
                  'set -eu',
                  'printf "run=%s\\n" "$SPECMAS_RUN_ID"',
                  'printf "phase=%s\\n" "$SPECMAS_PHASE_ID"',
                  'printf "task=%s\\n" "$SPECMAS_TASK_ID"',
                  'echo "task-log:$SPECMAS_PHASE_ID/$SPECMAS_TASK_ID" > /proc/1/fd/1'
                ].join('; ')
              ],
              env: {
                SPECMAS_RUN_ID: runId,
                SPECMAS_PHASE_ID: binding.phaseKey,
                SPECMAS_TASK_ID: binding.taskLabel
              }
            });

            const cancelledAfterExecution = state.cancelled;
            const taskStatus: TaskStatus =
              cancelledAfterExecution ? 'cancelled' : lifecycle.result.exitCode === 0 ? 'completed' : 'failed';
            const executionJson = JSON.stringify({
              taskKey,
              sandboxId: lifecycle.sandboxId,
              exitCode: lifecycle.result.exitCode,
              stdout: lifecycle.result.stdout,
              stderr: lifecycle.result.stderr,
              logs: lifecycle.logs.map((entry) => entry.message),
              completedAt: this.now().toISOString()
            });

            await this.persistTaskArtifacts(runId, binding, executionJson, lifecycle);

            await this.prisma.task.update({
              where: {
                id: binding.taskDbId
              },
              data: {
                status: taskStatus,
                completedAt: this.now(),
                resultJson: executionJson
              }
            });

            if (cancelledAfterExecution) {
              return {
                ok: false,
                output: JSON.stringify({ cancelled: true, taskKey }),
                error: 'Run cancelled'
              };
            }

            if (lifecycle.result.exitCode !== 0) {
              await this.prisma.phase.update({
                where: { id: binding.phaseDbId },
                data: {
                  status: 'failed',
                  completedAt: this.now(),
                  errorMessage: lifecycle.result.stderr || 'task execution failed'
                }
              });
            }

            return {
              ok: lifecycle.result.exitCode === 0,
              output: lifecycle.result.stdout,
              error: lifecycle.result.exitCode === 0 ? undefined : lifecycle.result.stderr || 'task execution failed'
            };
          } catch (error) {
            await this.prisma.task.update({
              where: {
                id: binding.taskDbId
              },
              data: {
                status: state.cancelled ? 'cancelled' : 'failed',
                completedAt: this.now(),
                resultJson: JSON.stringify({
                  taskKey,
                  error: recordError(error)
                })
              }
            });

            await this.prisma.phase.update({
              where: { id: binding.phaseDbId },
              data: {
                status: state.cancelled ? 'cancelled' : 'failed',
                completedAt: this.now(),
                errorMessage: recordError(error)
              }
            });

            return {
              ok: false,
              output: '',
              error: recordError(error)
            };
          }
        }
      });

      if (state.cancelled) {
        await this.cancelRun(runId);
        return;
      }

      for (const phase of workflowResult.phases) {
        await this.prisma.phase.updateMany({
          where: {
            runId,
            name: phase.phaseId,
            status: {
              in: ['pending', 'running'] satisfies PhaseStatus[]
            }
          },
          data: {
            status: phase.status === 'passed' ? 'completed' : 'failed',
            completedAt: this.now()
          }
        });
      }

      await this.prisma.run.update({
        where: { id: runId },
        data: {
          status: workflowResult.status === 'passed' ? 'completed' : 'failed',
          completedAt: this.now(),
          errorMessage: workflowResult.status === 'passed' ? null : 'workflow execution failed'
        }
      });
      await this.persistRunSummaryArtifacts(runId, workflowResult.status);
    } catch (error) {
      if (!state.cancelled) {
        await this.prisma.run.update({
          where: { id: runId },
          data: {
            status: 'failed',
            completedAt: this.now(),
            errorMessage: recordError(error)
          }
        });
      }
    } finally {
      this.activeRuns.delete(runId);
    }
  }

  private async persistTaskArtifacts(
    runId: string,
    binding: TaskBinding,
    executionJson: string,
    lifecycle: RuntimeExecutionResult
  ): Promise<void> {
    const taskDir = `phases/${sanitize(binding.phaseKey) || 'phase'}/tasks/${sanitize(binding.taskLabel) || 'task'}`;
    const stdoutPath = `${taskDir}/stdout.log`;
    const stderrPath = `${taskDir}/stderr.log`;
    const streamPath = `${taskDir}/runtime-stream.log`;
    const executionPath = `${taskDir}/execution.json`;

    const stdoutSize = await writeArtifact(runId, stdoutPath, lifecycle.result.stdout);
    const stderrSize = await writeArtifact(runId, stderrPath, lifecycle.result.stderr);
    const streamSize = await writeArtifact(
      runId,
      streamPath,
      lifecycle.logs.map((entry) => entry.message).join('\n')
    );
    const executionSize = await writeArtifact(runId, executionPath, executionJson);

    await this.prisma.artifact.createMany({
      data: [
        {
          runId,
          phaseId: binding.phaseDbId,
          taskId: binding.taskDbId,
          path: stdoutPath,
          type: 'log',
          sizeBytes: stdoutSize
        },
        {
          runId,
          phaseId: binding.phaseDbId,
          taskId: binding.taskDbId,
          path: stderrPath,
          type: 'log',
          sizeBytes: stderrSize
        },
        {
          runId,
          phaseId: binding.phaseDbId,
          taskId: binding.taskDbId,
          path: streamPath,
          type: 'log',
          sizeBytes: streamSize
        },
        {
          runId,
          phaseId: binding.phaseDbId,
          taskId: binding.taskDbId,
          path: executionPath,
          type: 'json',
          sizeBytes: executionSize
        }
      ]
    });
  }

  private async persistRunSummaryArtifacts(runId: string, status: 'passed' | 'failed'): Promise<void> {
    const gatePath = 'validation/gate-results.json';
    const summaryPath = 'run-summary.md';
    const gatePayload = JSON.stringify({
      runId,
      status,
      gates: status === 'passed' ? ['G1', 'G2', 'G3', 'G4'] : ['G1']
    });
    const summaryPayload =
      status === 'passed'
        ? `# Run Summary\n\nRun \`${runId}\` completed successfully.`
        : `# Run Summary\n\nRun \`${runId}\` failed.`;

    const gateSize = await writeArtifact(runId, gatePath, gatePayload);
    const summarySize = await writeArtifact(runId, summaryPath, summaryPayload);

    await this.prisma.artifact.createMany({
      data: [
        {
          runId,
          path: gatePath,
          type: 'json',
          sizeBytes: gateSize
        },
        {
          runId,
          path: summaryPath,
          type: 'md',
          sizeBytes: summarySize
        }
      ]
    });
  }
}

function runIdHint(projectId: string, startedAt: Date): string {
  return `${sanitize(projectId) || 'project'}-${startedAt.getTime()}`;
}
