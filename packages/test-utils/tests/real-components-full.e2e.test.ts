import { access, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  type AgentAdapter,
  type AgentExecutionRequest,
  type AgentRole
} from '../../adapters/src/contract.js';
import { ClaudeAdapter } from '../../adapters/src/claude.js';
import { CodexAdapter } from '../../adapters/src/codex.js';
import { GeminiAdapter } from '../../adapters/src/gemini.js';
import { parseSpecDocument } from '../../core/src/specParser.js';
import {
  createLocalDockerOpenHandsRuntimeAdapter,
  GitWorkspaceManager,
  createNodeCommandExecutor,
  type SandboxConfig
} from '../../runtime/src/index.js';
import { runLifecycle } from '../../runtime/src/lifecycle.js';
import { assertMergeReady, executeWorkflow } from '../../workflow/src/executor.js';
import { applyMergeApprovalAction, runGateSet } from '../../workflow/src/gates.js';
import { parseWorkflowYaml } from '../../workflow/src/schema.js';

const RUN_TRUE_E2E = process.env.RUN_TRUE_E2E === '1';
const RUN_TRUE_E2E_LOCAL_ONLY = process.env.RUN_TRUE_E2E_LOCAL_ONLY === '1';
const describeTrueE2E = RUN_TRUE_E2E ? describe : describe.skip;

const EXACT_BRIEF =
  'Build a simple resource schedule webapp for common office resources. Allow the user to input new rooms and equipment as needed. No authentication is required. This should run from npm locally on the system.';

const REQUIRED_ENV_VARS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'] as const;
const REQUIRED_COMMANDS = ['codex', 'claude', 'gemini', 'docker', 'npm', 'node'] as const;
const REQUIRED_DOCKER_IMAGE = 'nginx:alpine';

const PHASE_IDS = ['spec', 'implement', 'verify'] as const;
const TASK_IDS = [
  'build-spec',
  'implement-codex',
  'implement-claude',
  'implement-gemini',
  'verify-npm'
] as const;

type PhaseId = (typeof PHASE_IDS)[number];
type TaskId = (typeof TASK_IDS)[number];

const TASK_PHASE: Record<TaskId, PhaseId> = {
  'build-spec': 'spec',
  'implement-codex': 'implement',
  'implement-claude': 'implement',
  'implement-gemini': 'implement',
  'verify-npm': 'verify'
};

interface AgentInvocationRecord {
  adapterId: string;
  command: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
}

interface LifecycleRecord {
  sandboxId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
  logs: string[];
}

interface WorkflowTaskAudit {
  taskId: TaskId;
  phaseId: PhaseId;
  triggeredAt: string;
  lifecycle: LifecycleRecord;
  invocation?: AgentInvocationRecord;
  checks: Record<string, string | boolean>;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runLocalCliInvocation(
  tool: 'codex' | 'claude' | 'gemini',
  prompt: string,
  cwd: string
): Promise<AgentInvocationRecord> {
  const commandMap: Record<'codex' | 'claude' | 'gemini', string[]> = {
    codex: ['codex', 'exec', '--cd', cwd, '--skip-git-repo-check', prompt],
    claude: ['claude', '--print', '--output-format', 'text', '--add-dir', cwd, prompt],
    gemini: ['gemini', '--prompt', prompt, '--output-format', 'text', '--include-directories', cwd]
  };

  const command = commandMap[tool];
  const [binary, ...args] = command;
  const startedAt = new Date().toISOString();
  const result = await new Promise<CommandResult>((resolve) => {
    const child = spawn(binary, args, {
      cwd,
      env: process.env
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 180_000);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', (error) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: 1,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim()
      });
    });
    child.once('close', (code) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout,
        stderr: timedOut ? `${stderr}\ncommand timed out after 180s`.trim() : stderr
      });
    });
  });
  const completedAt = new Date().toISOString();

  const adapterId = tool === 'codex' ? 'agent-codex' : tool === 'claude' ? 'agent-claude-code' : 'agent-gemini-cli';
  return {
    adapterId,
    command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    startedAt,
    completedAt
  };
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const artifactsRoot = join(repoRoot, 'artifacts');
const hostCommandExecutor = createNodeCommandExecutor();

const runtimeSandboxIds = new Set<string>();
const workspaceRoots: string[] = [];

function commandDetail(result: CommandResult): string {
  const detail = result.stderr.trim() || result.stdout.trim();
  return detail.length > 0 ? detail : `exit code ${result.exitCode}`;
}

function parseIso(value: string): number {
  const parsed = Date.parse(value);
  expect(Number.isNaN(parsed)).toBe(false);
  return parsed;
}

function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function toolchainCredentials(adapter: AgentAdapter): Record<string, string> {
  return Object.fromEntries(
    adapter.requiredCredentialEnv.map((key) => {
      const value = process.env[key];
      if (!value) {
        throw new Error(`Missing required credentials: ${key}`);
      }
      return [key, value];
    })
  );
}

function toAgentRequest(
  prompt: string,
  cwd: string,
  role: AgentRole,
  runId: string,
  taskId: TaskId,
  adapter: AgentAdapter
): AgentExecutionRequest {
  return {
    role,
    prompt,
    cwd,
    timeoutSeconds: 1_200,
    credentials: toolchainCredentials(adapter),
    env: {
      SPECMAS_RUN_ID: runId,
      SPECMAS_TASK_ID: taskId,
      SPECMAS_TRUE_E2E: '1'
    }
  };
}

async function commandExists(command: string): Promise<boolean> {
  const result = await hostCommandExecutor({
    command: '/bin/sh',
    args: ['-lc', `command -v ${command}`]
  });

  return result.exitCode === 0;
}

async function runAgentInvocation(
  adapter: AgentAdapter,
  request: AgentExecutionRequest
): Promise<AgentInvocationRecord> {
  const plan = adapter.createExecutionPlan(request);
  const [command, ...args] = plan.command;
  if (!command) {
    throw new Error(`Adapter ${adapter.id} returned an empty command`);
  }

  const startedAt = new Date().toISOString();
  const result = await hostCommandExecutor({
    command,
    args,
    cwd: request.cwd,
    env: plan.env
  });
  const completedAt = new Date().toISOString();

  return {
    adapterId: adapter.id,
    command: [...plan.command],
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    startedAt,
    completedAt
  };
}

async function forceRemoveSandboxes(sandboxIds: readonly string[]): Promise<void> {
  await Promise.all(
    sandboxIds.map(async (sandboxId) => {
      await hostCommandExecutor({
        command: 'docker',
        args: ['rm', '-f', sandboxId]
      });
    })
  );
}

async function sandboxExists(sandboxId: string): Promise<boolean> {
  const inspectResult = await hostCommandExecutor({
    command: 'docker',
    args: ['container', 'inspect', sandboxId]
  });

  return inspectResult.exitCode === 0;
}

async function createWorkspace(): Promise<{
  workspaceRoot: string;
  projectRoot: string;
  specPath: string;
  workflowPath: string;
}> {
  await mkdir(artifactsRoot, { recursive: true });
  const workspaceRoot = await mkdtemp(join(artifactsRoot, 'real-components-full-'));
  workspaceRoots.push(workspaceRoot);

  const projectRoot = join(workspaceRoot, 'resource-schedule-webapp');
  const specDir = join(workspaceRoot, 'specs');
  await mkdir(projectRoot, { recursive: true });
  await mkdir(specDir, { recursive: true });

  return {
    workspaceRoot,
    projectRoot,
    specPath: join(specDir, 'resource-schedule.spec.md'),
    workflowPath: join(workspaceRoot, 'workflow.yml')
  };
}

function composeWorkflowYaml(): string {
  return [
    'name: real-components-full-e2e',
    'phases:',
    '  - id: spec',
    '    mode: sequential',
    '    tasks:',
    '      - build-spec',
    '    gates:',
    '      - G1',
    '  - id: implement',
    '    mode: sequential',
    '    tasks:',
    '      - implement-codex',
    '      - implement-claude',
    '      - implement-gemini',
    '    gates:',
    '      - G2',
    '      - G3',
    '  - id: verify',
    '    mode: sequential',
    '    tasks:',
    '      - verify-npm',
    '    gates:',
    '      - G4'
  ].join('\n');
}

async function preflightChecks(): Promise<void> {
  const missingEnvVars = RUN_TRUE_E2E_LOCAL_ONLY ? [] : REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  const requiredCommands = RUN_TRUE_E2E_LOCAL_ONLY ? [...REQUIRED_COMMANDS] : [...REQUIRED_COMMANDS];
  const missingCommands: string[] = [];
  for (const command of requiredCommands) {
    if (!(await commandExists(command))) {
      missingCommands.push(command);
    }
  }

  if (missingEnvVars.length > 0 || missingCommands.length > 0) {
    const envText =
      missingEnvVars.length > 0 ? `missing env vars: ${missingEnvVars.join(', ')}` : undefined;
    const commandText =
      missingCommands.length > 0 ? `missing commands: ${missingCommands.join(', ')}` : undefined;
    throw new Error(
      `RUN_TRUE_E2E=1 preflight failed (${[envText, commandText].filter(Boolean).join(' | ')})`
    );
  }

  const dockerInfo = await hostCommandExecutor({
    command: 'docker',
    args: ['info', '--format', '{{.ServerVersion}}']
  });
  if (dockerInfo.exitCode !== 0) {
    throw new Error(
      `RUN_TRUE_E2E=1 preflight failed (docker daemon unavailable: ${commandDetail(dockerInfo)})`
    );
  }

  const imageCheck = await hostCommandExecutor({
    command: 'docker',
    args: ['image', 'inspect', REQUIRED_DOCKER_IMAGE, '--format', '{{.Id}}']
  });
  if (imageCheck.exitCode !== 0) {
    throw new Error(
      `RUN_TRUE_E2E=1 preflight failed (required docker image "${REQUIRED_DOCKER_IMAGE}" missing)`
    );
  }
}

describeTrueE2E('real-components full true e2e', () => {
  beforeAll(async () => {
    await preflightChecks();
  });

  afterEach(async () => {
    const sandboxes = [...runtimeSandboxIds];
    runtimeSandboxIds.clear();
    await forceRemoveSandboxes(sandboxes);
    await Promise.all(workspaceRoots.map((workspaceRoot) => rm(workspaceRoot, { recursive: true, force: true })));
    workspaceRoots.length = 0;
  });

  it(
    'builds spec, invokes codex/claude/gemini, validates gates, and verifies OpenHands workflow timing',
    async () => {
      const runId = 'run-real-components-full-0001';
      const { workspaceRoot, projectRoot, specPath, workflowPath } = await createWorkspace();

      const workflowYaml = composeWorkflowYaml();
      await hostCommandExecutor({
        command: '/bin/sh',
        args: ['-lc', `cat <<'EOF' > "${workflowPath}"\n${workflowYaml}\nEOF`]
      });
      const parsedWorkflow = parseWorkflowYaml(await readFile(workflowPath, 'utf8'));
      expect(parsedWorkflow.diagnostics).toEqual([]);
      expect(parsedWorkflow.workflow).not.toBeNull();

      const workflow = parsedWorkflow.workflow;
      if (!workflow) {
        throw new Error('Expected workflow to parse successfully');
      }
      expect(workflow.phases.map((phase) => phase.id)).toEqual([...PHASE_IDS]);
      const expectedWorkflowGateIds = uniqueInOrder(workflow.phases.flatMap((phase) => phase.gates));
      expect(expectedWorkflowGateIds.length).toBeGreaterThan(0);

      const codex = new CodexAdapter();
      const claude = new ClaudeAdapter();
      const gemini = new GeminiAdapter();

      const invocations: AgentInvocationRecord[] = [];

      const runtimeAdapter = createLocalDockerOpenHandsRuntimeAdapter();
      const sandboxConfig: SandboxConfig = {
        image: REQUIRED_DOCKER_IMAGE,
        workspacePath: workspaceRoot,
        cpuLimit: 1,
        memoryMb: 512,
        networkEnabled: false
      };

      const workflowResult = await executeWorkflow(workflow, {
        async runTask(taskId: string) {
          if (!TASK_IDS.includes(taskId as TaskId)) {
            return {
              ok: false,
              output: '',
              error: `Unknown workflow task "${taskId}"`
            };
          }

          const typedTaskId = taskId as TaskId;
          const phaseId = TASK_PHASE[typedTaskId];
          const triggeredAt = new Date().toISOString();
          const lifecycle = await runLifecycle(runtimeAdapter, {
            sandboxConfig,
            command: [
              '/bin/sh',
              '-lc',
              [
                'set -eu',
                'printf "phase=%s\\n" "$SPECMAS_PHASE_ID"',
                'printf "task=%s\\n" "$SPECMAS_TASK_ID"',
                'printf "run=%s\\n" "$SPECMAS_RUN_ID"',
                'echo "workflow-item:$SPECMAS_PHASE_ID/$SPECMAS_TASK_ID" > /proc/1/fd/1'
              ].join('; ')
            ],
            env: {
              SPECMAS_PHASE_ID: phaseId,
              SPECMAS_TASK_ID: typedTaskId,
              SPECMAS_RUN_ID: runId
            }
          });
          runtimeSandboxIds.add(lifecycle.sandboxId);

          const lifecycleRecord: LifecycleRecord = {
            sandboxId: lifecycle.sandboxId,
            exitCode: lifecycle.result.exitCode,
            stdout: lifecycle.result.stdout,
            stderr: lifecycle.result.stderr,
            startedAt: lifecycle.result.startedAt,
            completedAt: lifecycle.result.completedAt,
            logs: lifecycle.logs.map((event) => event.message)
          };

          try {
            if (typedTaskId === 'build-spec') {
              if (RUN_TRUE_E2E_LOCAL_ONLY) {
                const prompt = [
                  `Create the file "${specPath}" as a valid Spec-MAS markdown document.`,
                  `Use this exact brief verbatim as source requirements: "${EXACT_BRIEF}"`,
                  'The output spec must contain front matter with:',
                  '- specmas: v4',
                  '- kind: FeatureSpec',
                  '- id, name, version, complexity (EASY|MODERATE|HIGH), maturity (1-4)',
                  'The body must include required sections:',
                  '- Overview',
                  '- Functional Requirements',
                  '- Acceptance Criteria',
                  'Do not create any other files.'
                ].join('\n');
                const invocation = await runLocalCliInvocation('codex', prompt, workspaceRoot);
                invocations.push(invocation);

                if (invocation.exitCode !== 0) {
                  return {
                    ok: false,
                    output: JSON.stringify({
                      taskId: typedTaskId,
                      phaseId,
                      triggeredAt,
                      lifecycle: lifecycleRecord,
                      invocation,
                      checks: { specFileCreated: false, localCliExitZero: false }
                    } satisfies WorkflowTaskAudit),
                    error: `local-only codex build-spec failed: ${commandDetail(invocation)}`
                  };
                }

                await access(specPath);
                const specMarkdown = await readFile(specPath, 'utf8');
                const parsedSpec = parseSpecDocument(specMarkdown);

                const audit: WorkflowTaskAudit = {
                  taskId: typedTaskId,
                  phaseId,
                  triggeredAt,
                  lifecycle: lifecycleRecord,
                  invocation,
                  checks: {
                    specFileCreated: true,
                    specParsed: true,
                    includesRooms: parsedSpec.body.toLowerCase().includes('room'),
                    includesEquipment: parsedSpec.body.toLowerCase().includes('equipment'),
                    includesNoAuth: parsedSpec.body.toLowerCase().includes('no authentication'),
                    includesNpm: parsedSpec.body.toLowerCase().includes('npm')
                  }
                };

                return {
                  ok: specMarkdown.trim().length > 0,
                  output: JSON.stringify(audit)
                };
              }

              const prompt = [
                `Create the file "${specPath}" as a valid Spec-MAS markdown document.`,
                `Use this exact brief verbatim as source requirements: "${EXACT_BRIEF}"`,
                'The output spec must contain front matter with:',
                '- specmas: v4',
                '- kind: FeatureSpec',
                '- id, name, version, complexity, maturity',
                'The body must include required sections:',
                '- Overview',
                '- Functional Requirements',
                '- Acceptance Criteria',
                'Do not create any other files.'
              ].join('\n');
              const invocation = await runAgentInvocation(
                codex,
                toAgentRequest(prompt, workspaceRoot, 'implement', runId, typedTaskId, codex)
              );
              invocations.push(invocation);

              if (invocation.exitCode !== 0) {
                return {
                  ok: false,
                  output: JSON.stringify({
                    taskId: typedTaskId,
                    phaseId,
                    triggeredAt,
                    lifecycle: lifecycleRecord,
                    invocation,
                    checks: { specFileCreated: false }
                  } satisfies WorkflowTaskAudit),
                  error: `codex build-spec failed: ${commandDetail(invocation)}`
                };
              }

              await access(specPath);
              const specMarkdown = await readFile(specPath, 'utf8');
              const parsedSpec = parseSpecDocument(specMarkdown);

              const audit: WorkflowTaskAudit = {
                taskId: typedTaskId,
                phaseId,
                triggeredAt,
                lifecycle: lifecycleRecord,
                invocation,
                checks: {
                  specFileCreated: true,
                  specParsed: true,
                  includesRooms: parsedSpec.body.toLowerCase().includes('room'),
                  includesEquipment: parsedSpec.body.toLowerCase().includes('equipment'),
                  includesNoAuth: parsedSpec.body.toLowerCase().includes('no authentication'),
                  includesNpm: parsedSpec.body.toLowerCase().includes('npm')
                }
              };

              const briefChecks = [
                audit.checks.includesRooms,
                audit.checks.includesEquipment,
                audit.checks.includesNoAuth,
                audit.checks.includesNpm
              ].every((value) => value === true);

              return {
                ok: briefChecks,
                output: JSON.stringify(audit),
                error: briefChecks ? undefined : 'Generated spec did not capture the full brief'
              };
            }

            if (typedTaskId === 'implement-codex') {
              if (RUN_TRUE_E2E_LOCAL_ONLY) {
                const prompt = [
                  `Using "${specPath}", implement the app in "${projectRoot}".`,
                  'Create or update these files:',
                  '- package.json',
                  '- server.mjs',
                  '- public/index.html',
                  '- public/app.mjs',
                  '- tests/app.test.mjs',
                  'Requirements:',
                  '- npm scripts include "start" and "test"',
                  '- no authentication',
                  '- allow adding rooms and equipment and scheduling them',
                  '- use vanilla JavaScript and Node built-ins only',
                  '- include deterministic tests for happy/error/edge paths',
                  'Do not run npm install.'
                ].join('\n');
                const invocation = await runLocalCliInvocation('codex', prompt, workspaceRoot);
                invocations.push(invocation);

                const requiredFiles = [
                  join(projectRoot, 'package.json'),
                  join(projectRoot, 'server.mjs'),
                  join(projectRoot, 'public', 'index.html'),
                  join(projectRoot, 'public', 'app.mjs'),
                  join(projectRoot, 'tests', 'app.test.mjs')
                ];

                let filesExist = true;
                for (const file of requiredFiles) {
                  try {
                    await access(file);
                  } catch {
                    filesExist = false;
                    break;
                  }
                }

                const audit: WorkflowTaskAudit = {
                  taskId: typedTaskId,
                  phaseId,
                  triggeredAt,
                  lifecycle: lifecycleRecord,
                  invocation,
                  checks: {
                    codexExitZero: invocation.exitCode === 0,
                    requiredFilesPresent: filesExist
                  }
                };

                return {
                  ok: invocation.exitCode === 0 && filesExist,
                  output: JSON.stringify(audit),
                  error:
                    invocation.exitCode === 0 && filesExist
                      ? undefined
                      : 'local-only codex did not produce required app files'
                };
              }

              const prompt = [
                `Using "${specPath}", implement the app in "${projectRoot}".`,
                'Create or update these files:',
                '- package.json',
                '- server.mjs',
                '- public/index.html',
                '- public/app.mjs',
                '- tests/app.test.mjs',
                'Requirements:',
                '- npm scripts include "start" and "test"',
                '- no authentication',
                '- allow adding rooms and equipment and scheduling them',
                '- use vanilla JavaScript and Node built-ins only',
                '- include deterministic tests for happy/error/edge paths',
                'Do not run npm install.'
              ].join('\n');
              const invocation = await runAgentInvocation(
                codex,
                toAgentRequest(prompt, workspaceRoot, 'implement', runId, typedTaskId, codex)
              );
              invocations.push(invocation);

              const requiredFiles = [
                join(projectRoot, 'package.json'),
                join(projectRoot, 'server.mjs'),
                join(projectRoot, 'public', 'index.html'),
                join(projectRoot, 'public', 'app.mjs'),
                join(projectRoot, 'tests', 'app.test.mjs')
              ];

              let filesExist = true;
              for (const file of requiredFiles) {
                try {
                  await access(file);
                } catch {
                  filesExist = false;
                  break;
                }
              }

              const audit: WorkflowTaskAudit = {
                taskId: typedTaskId,
                phaseId,
                triggeredAt,
                lifecycle: lifecycleRecord,
                invocation,
                checks: {
                  codexExitZero: invocation.exitCode === 0,
                  requiredFilesPresent: filesExist
                }
              };

              return {
                ok: invocation.exitCode === 0 && filesExist,
                output: JSON.stringify(audit),
                error:
                  invocation.exitCode === 0 && filesExist
                    ? undefined
                    : 'codex implementation did not produce required app files'
              };
            }

            if (typedTaskId === 'implement-claude') {
              if (RUN_TRUE_E2E_LOCAL_ONLY) {
                const indexPath = join(projectRoot, 'public', 'index.html');
                const before = await readFile(indexPath, 'utf8');
                const prompt = [
                  `In "${indexPath}", update the existing UI only.`,
                  'Requirements:',
                  '- include visible text "No authentication required"',
                  '- include input with id "room-name-input"',
                  '- include input with id "equipment-name-input"',
                  '- keep app behavior deterministic and local',
                  'Do not modify any file except public/index.html.'
                ].join('\n');
                const invocation = await runLocalCliInvocation('claude', prompt, workspaceRoot);
                invocations.push(invocation);
                const indexHtml = await readFile(indexPath, 'utf8');
                const changed = indexHtml !== before;
                const hasNoAuth = indexHtml.includes('No authentication required');
                const hasRoomInput = indexHtml.includes('room-name-input');
                const hasEquipmentInput = indexHtml.includes('equipment-name-input');
                const ok = invocation.exitCode === 0 && changed && hasNoAuth && hasRoomInput && hasEquipmentInput;

                const audit: WorkflowTaskAudit = {
                  taskId: typedTaskId,
                  phaseId,
                  triggeredAt,
                  lifecycle: lifecycleRecord,
                  invocation,
                  checks: {
                    claudeExitZero: invocation.exitCode === 0,
                    indexHtmlChanged: changed,
                    hasNoAuth,
                    hasRoomInput,
                    hasEquipmentInput
                  }
                };

                return {
                  ok,
                  output: JSON.stringify(audit),
                  error: ok ? undefined : 'local-only index.html checks failed'
                };
              }

              const prompt = [
                `In "${join(projectRoot, 'public', 'index.html')}", update the existing UI only.`,
                'Requirements:',
                '- include visible text "No authentication required"',
                '- include input with id "room-name-input"',
                '- include input with id "equipment-name-input"',
                '- keep app behavior deterministic and local',
                'Do not modify any file except public/index.html.'
              ].join('\n');
              const invocation = await runAgentInvocation(
                claude,
                toAgentRequest(prompt, workspaceRoot, 'implement', runId, typedTaskId, claude)
              );
              invocations.push(invocation);

              const indexHtml = await readFile(join(projectRoot, 'public', 'index.html'), 'utf8');
              const hasNoAuth = indexHtml.includes('No authentication required');
              const hasRoomInput = indexHtml.includes('room-name-input');
              const hasEquipmentInput = indexHtml.includes('equipment-name-input');

              const audit: WorkflowTaskAudit = {
                taskId: typedTaskId,
                phaseId,
                triggeredAt,
                lifecycle: lifecycleRecord,
                invocation,
                checks: {
                  claudeExitZero: invocation.exitCode === 0,
                  hasNoAuth,
                  hasRoomInput,
                  hasEquipmentInput
                }
              };

              const ok = invocation.exitCode === 0 && hasNoAuth && hasRoomInput && hasEquipmentInput;
              return {
                ok,
                output: JSON.stringify(audit),
                error: ok ? undefined : 'claude did not apply required index.html updates'
              };
            }

            if (typedTaskId === 'implement-gemini') {
              if (RUN_TRUE_E2E_LOCAL_ONLY) {
                const testPath = join(projectRoot, 'tests', 'app.test.mjs');
                const before = await readFile(testPath, 'utf8');
                const prompt = [
                  `In "${testPath}", add additional deterministic coverage.`,
                  'Keep and expand tests to include:',
                  '- happy path',
                  '- failure path',
                  '- edge/boundary path',
                  'Use node:test and strict assertions.',
                  'Do not modify files other than tests/app.test.mjs.'
                ].join('\n');
                const invocation = await runLocalCliInvocation('gemini', prompt, workspaceRoot);
                invocations.push(invocation);
                const testsContent = await readFile(testPath, 'utf8');
                const changed = testsContent !== before;
                const testCount = [...testsContent.matchAll(/\btest\s*\(/gu)].length;
                const ok = invocation.exitCode === 0 && changed && testCount >= 3;

                const audit: WorkflowTaskAudit = {
                  taskId: typedTaskId,
                  phaseId,
                  triggeredAt,
                  lifecycle: lifecycleRecord,
                  invocation,
                  checks: {
                    geminiExitZero: invocation.exitCode === 0,
                    testsChanged: changed,
                    minimumTestCount: ok
                  }
                };

                return {
                  ok,
                  output: JSON.stringify(audit),
                  error: ok ? undefined : 'local-only test coverage checks failed'
                };
              }

              const prompt = [
                `In "${join(projectRoot, 'tests', 'app.test.mjs')}", add additional deterministic coverage.`,
                'Keep and expand tests to include:',
                '- happy path',
                '- failure path',
                '- edge/boundary path',
                'Use node:test and strict assertions.',
                'Do not modify files other than tests/app.test.mjs.'
              ].join('\n');
              const invocation = await runAgentInvocation(
                gemini,
                toAgentRequest(prompt, workspaceRoot, 'test', runId, typedTaskId, gemini)
              );
              invocations.push(invocation);

              const testsContent = await readFile(join(projectRoot, 'tests', 'app.test.mjs'), 'utf8');
              const testCount = [...testsContent.matchAll(/\btest\s*\(/gu)].length;

              const audit: WorkflowTaskAudit = {
                taskId: typedTaskId,
                phaseId,
                triggeredAt,
                lifecycle: lifecycleRecord,
                invocation,
                checks: {
                  geminiExitZero: invocation.exitCode === 0,
                  minimumTestCount: testCount >= 3
                }
              };

              const ok = invocation.exitCode === 0 && testCount >= 3;
              return {
                ok,
                output: JSON.stringify(audit),
                error: ok ? undefined : 'gemini did not produce sufficient test coverage'
              };
            }

            const npmTest = await hostCommandExecutor({
              command: 'npm',
              args: ['test'],
              cwd: projectRoot
            });
            const serverCheck = await hostCommandExecutor({
              command: 'node',
              args: ['--check', 'server.mjs'],
              cwd: projectRoot
            });
            const packageJsonRaw = await readFile(join(projectRoot, 'package.json'), 'utf8');
            const packageJson = JSON.parse(packageJsonRaw) as {
              scripts?: Record<string, string>;
            };

            const audit: WorkflowTaskAudit = {
              taskId: typedTaskId,
              phaseId,
              triggeredAt,
              lifecycle: lifecycleRecord,
              checks: {
                npmTestPass: npmTest.exitCode === 0,
                serverCheckPass: serverCheck.exitCode === 0,
                hasStartScript: Boolean(packageJson.scripts?.start),
                hasTestScript: Boolean(packageJson.scripts?.test)
              }
            };

            const ok =
              npmTest.exitCode === 0 &&
              serverCheck.exitCode === 0 &&
              Boolean(packageJson.scripts?.start) &&
              Boolean(packageJson.scripts?.test);

            return {
              ok,
              output: JSON.stringify(audit),
              error: ok
                ? undefined
                : `npm verification failed (npm test: ${commandDetail(npmTest)} | server: ${commandDetail(serverCheck)})`
            };
          } catch (error) {
            return {
              ok: false,
              output: JSON.stringify({
                taskId: typedTaskId,
                phaseId,
                triggeredAt,
                lifecycle: lifecycleRecord,
                checks: { exception: true, message: (error as Error).message }
              } satisfies WorkflowTaskAudit),
              error: `Task "${typedTaskId}" failed: ${(error as Error).message}`
            };
          }
        }
      });

      if (workflowResult.status !== 'passed') {
        throw new Error(
          `Workflow failed: ${JSON.stringify(
            workflowResult.phases.map((phase) => ({
              phaseId: phase.phaseId,
              status: phase.status,
              errors: phase.tasks.filter((task) => task.status !== 'passed').map((task) => task.error)
            }))
          )}`
        );
      }
      expect(workflowResult.status).toBe('passed');
      expect(workflowResult.phases.map((phase) => phase.phaseId)).toEqual([...PHASE_IDS]);
      expect(workflowResult.phases.every((phase) => phase.status === 'passed')).toBe(true);

      const taskAudits = workflowResult.phases
        .flatMap((phase) => phase.tasks)
        .map((task) => JSON.parse(task.output) as WorkflowTaskAudit);
      expect(taskAudits).toHaveLength(TASK_IDS.length);

      const taskOrder = taskAudits.map((audit) => audit.taskId);
      expect(taskOrder).toEqual([...TASK_IDS]);
      taskAudits.forEach((audit) => {
        expect(audit.lifecycle.exitCode).toBe(0);
        expect(audit.lifecycle.logs).toContain(`workflow-item:${audit.phaseId}/${audit.taskId}`);
      });

      const chronological = taskAudits.map((audit) => ({
        taskId: audit.taskId,
        triggeredAtMs: parseIso(audit.triggeredAt),
        startedAtMs: parseIso(audit.lifecycle.startedAt),
        completedAtMs: parseIso(audit.lifecycle.completedAt)
      }));
      chronological.forEach((entry) => {
        expect(entry.startedAtMs).toBeGreaterThanOrEqual(entry.triggeredAtMs);
        expect(entry.completedAtMs).toBeGreaterThanOrEqual(entry.startedAtMs);
      });
      for (let index = 1; index < chronological.length; index += 1) {
        expect(chronological[index]?.triggeredAtMs ?? 0).toBeGreaterThanOrEqual(
          chronological[index - 1]?.completedAtMs ?? 0
        );
      }

      const sandboxStates = await Promise.all(
        [...runtimeSandboxIds].map(async (sandboxId) => ({
          sandboxId,
          exists: await sandboxExists(sandboxId)
        }))
      );
      sandboxStates.forEach((sandboxState) => {
        expect(sandboxState.exists).toBe(false);
      });

      const parsedSpec = parseSpecDocument(await readFile(specPath, 'utf8'));
      expect(parsedSpec.frontMatter.kind).toBe('FeatureSpec');
      expect(parsedSpec.sections).toEqual(
        expect.arrayContaining(['Overview', 'Functional Requirements', 'Acceptance Criteria'])
      );

      expect(invocations.length).toBeGreaterThanOrEqual(4);
      expect(invocations.every((invocation) => invocation.exitCode === 0)).toBe(true);
      expect(
        [...new Set(invocations.map((invocation) => invocation.adapterId))].sort()
      ).toEqual(['agent-claude-code', 'agent-codex', 'agent-gemini-cli']);
      expect(
        [...new Set(invocations.map((invocation) => invocation.command[0]))].sort()
      ).toEqual(['claude', 'codex', 'gemini']);

      if (RUN_TRUE_E2E_LOCAL_ONLY) {
        const codexAudit = taskAudits.find((audit) => audit.taskId === 'implement-codex');
        const claudeAudit = taskAudits.find((audit) => audit.taskId === 'implement-claude');
        const geminiAudit = taskAudits.find((audit) => audit.taskId === 'implement-gemini');

        expect(codexAudit?.checks.requiredFilesPresent).toBe(true);
        expect(claudeAudit?.checks.indexHtmlChanged).toBe(true);
        expect(geminiAudit?.checks.testsChanged).toBe(true);
      }

      const successfulPhaseIds = workflowResult.phases
        .filter((phase) => phase.status === 'passed')
        .map((phase) => phase.phaseId);
      const triggeredGateEvents = successfulPhaseIds.flatMap((phaseId) => {
        const phaseDefinition = workflow.phases.find((phase) => phase.id === phaseId);
        return (phaseDefinition?.gates ?? []).map((gateId, index) => ({
          phaseId,
          gateId,
          sequence: index + 1
        }));
      });
      const triggeredGateIds = uniqueInOrder(triggeredGateEvents.map((event) => event.gateId));

      expect(triggeredGateIds).toEqual(expectedWorkflowGateIds);
      expect([...new Set(triggeredGateIds)]).toEqual([...new Set(expectedWorkflowGateIds)]);
      expect(triggeredGateEvents.map((event) => event.gateId)).toEqual(expectedWorkflowGateIds);

      const gateResult = runGateSet(expectedWorkflowGateIds, {
        structurePass: parsedSpec.sections.length >= 3,
        semanticsPass: taskAudits.find((audit) => audit.taskId === 'verify-npm')?.checks.npmTestPass === true,
        traceabilityPass:
          parsedSpec.body.toLowerCase().includes('room') &&
          parsedSpec.body.toLowerCase().includes('equipment') &&
          parsedSpec.body.toLowerCase().includes('no authentication'),
        determinismPass:
          chronological.every((entry) => entry.completedAtMs >= entry.startedAtMs) &&
          sandboxStates.every((sandboxState) => sandboxState.exists === false)
      });

      const findingsByGateId = new Map(gateResult.findings.map((finding) => [finding.gateId, finding]));
      triggeredGateEvents.forEach((event) => {
        const finding = findingsByGateId.get(event.gateId);
        expect(finding).toBeDefined();
        expect(finding?.passed).toBe(true);
      });

      expect(gateResult.findings.map((finding) => finding.gateId)).toEqual(expectedWorkflowGateIds);
      expect(gateResult.findings.every((finding) => finding.passed)).toBe(true);
      expect(gateResult.passed).toBe(true);
    },
    1_200_000
  );

  it(
    'project selection drives dedicated branches and human-approved merge',
    async () => {
      const runId = 'run-real-components-merge-0001';
      const { workspaceRoot, projectRoot } = await createWorkspace();
      const selectedProject = {
        projectId: 'alpha',
        repoUrl: 'https://github.com/specmas/alpha',
        defaultBranch: 'main'
      };
      expect(selectedProject.projectId).toBe('alpha');

      const gitWorkspace = new GitWorkspaceManager();
      const codexBranch = gitWorkspace.allocateTaskBranch(runId, 'issue-101');
      const claudeBranch = gitWorkspace.allocateTaskBranch(runId, 'issue-102');
      const geminiBranch = gitWorkspace.allocateTaskBranch(runId, 'issue-103');
      expect(new Set([codexBranch, claudeBranch, geminiBranch]).size).toBe(3);
      expect(codexBranch.startsWith(`specmas/${runId}/`)).toBe(true);

      const runtimeAdapter = createLocalDockerOpenHandsRuntimeAdapter();
      const sandboxConfig: SandboxConfig = {
        image: REQUIRED_DOCKER_IMAGE,
        workspacePath: workspaceRoot,
        cpuLimit: 1,
        memoryMb: 512,
        networkEnabled: false
      };

      const lifecycle = await runLifecycle(runtimeAdapter, {
        sandboxConfig,
        command: [
          '/bin/sh',
          '-lc',
          ['set -eu', 'echo "project=$SPECMAS_PROJECT_ID"', 'echo "branch=$SPECMAS_WORKING_BRANCH"'].join('; ')
        ],
        env: {
          SPECMAS_PROJECT_ID: selectedProject.projectId,
          SPECMAS_WORKING_BRANCH: codexBranch
        }
      });
      runtimeSandboxIds.add(lifecycle.sandboxId);
      expect(lifecycle.result.exitCode).toBe(0);
      expect(lifecycle.result.stdout).toContain('project=alpha');
      expect(lifecycle.result.stdout).toContain(`branch=${codexBranch}`);

      await mkdir(join(projectRoot, 'src'), { recursive: true });

      const codexPrompt = `Create "${join(projectRoot, 'src', 'codex.txt')}" with one line: codex branch ${codexBranch}`;
      const claudePrompt = `Create "${join(projectRoot, 'src', 'claude.txt')}" with one line: claude branch ${claudeBranch}`;
      const geminiPrompt = `Create "${join(projectRoot, 'src', 'gemini.txt')}" with one line: gemini branch ${geminiBranch}`;

      const invocationRecords: AgentInvocationRecord[] = [];
      if (RUN_TRUE_E2E_LOCAL_ONLY) {
        invocationRecords.push(await runLocalCliInvocation('codex', codexPrompt, workspaceRoot));
        invocationRecords.push(await runLocalCliInvocation('claude', claudePrompt, workspaceRoot));
        invocationRecords.push(await runLocalCliInvocation('gemini', geminiPrompt, workspaceRoot));
      } else {
        const codex = new CodexAdapter();
        const claude = new ClaudeAdapter();
        const gemini = new GeminiAdapter();
        invocationRecords.push(
          await runAgentInvocation(codex, toAgentRequest(codexPrompt, workspaceRoot, 'implement', runId, 'implement-codex', codex))
        );
        invocationRecords.push(
          await runAgentInvocation(
            claude,
            toAgentRequest(claudePrompt, workspaceRoot, 'implement', runId, 'implement-claude', claude)
          )
        );
        invocationRecords.push(
          await runAgentInvocation(
            gemini,
            toAgentRequest(geminiPrompt, workspaceRoot, 'test', runId, 'implement-gemini', gemini)
          )
        );
      }

      expect(invocationRecords.every((record) => record.exitCode === 0)).toBe(true);
      expect([...new Set(invocationRecords.map((record) => record.command[0]))].sort()).toEqual([
        'claude',
        'codex',
        'gemini'
      ]);

      await access(join(projectRoot, 'src', 'codex.txt'));
      await access(join(projectRoot, 'src', 'claude.txt'));
      await access(join(projectRoot, 'src', 'gemini.txt'));

      const awaiting = {
        runId,
        status: 'awaiting_human_approval' as const,
        updatedAt: new Date().toISOString()
      };
      expect(() => assertMergeReady(awaiting.status)).toThrow('merge blocked: status is awaiting_human_approval');
      const approved = applyMergeApprovalAction(awaiting, 'approve');
      expect(() => assertMergeReady(approved.status)).not.toThrow();
      const merged = applyMergeApprovalAction(approved, 'merge');
      expect(merged.status).toBe('merged');
    },
    600_000
  );
});
