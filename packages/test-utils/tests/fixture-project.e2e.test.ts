import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CodexAdapter } from '../../adapters/src/codex.js';
import { FileSystemArtifactManager } from '../../artifacts/src/manager.js';
import { resolveConfigPrecedence } from '../../config/src/precedence.js';
import { parseSpecDocument } from '../../core/src/specParser.js';
import { decomposeRequirements } from '../../github/src/decomposition.js';
import { transitionIssueState } from '../../github/src/issueState.js';
import {
  GitHubChannelAdapter,
  SlackChannelAdapter
} from '../../notifications/src/channels.js';
import { NotificationsEngine } from '../../notifications/src/engine.js';
import type { SandboxConfig } from '../../runtime/src/contracts.js';
import {
  createLocalDockerOpenHandsRuntimeAdapter,
  createNodeCommandExecutor
} from '../../runtime/src/index.js';
import { runLifecycle } from '../../runtime/src/lifecycle.js';
import { executeWorkflow } from '../../workflow/src/executor.js';
import { selectAdapter } from '../../workflow/src/routing.js';
import { parseWorkflowYaml } from '../../workflow/src/schema.js';
import {
  createDeterministicCorrelationIdGenerator,
  type StructuredLogEntry
} from '../../../apps/api/src/logging.js';
import { createServer } from '../../../apps/api/src/server.js';
import {
  InMemoryConversationSessionService,
  createDeterministicSessionClock,
  createDeterministicSessionIdGenerator
} from '../../../apps/api/src/sessionService.js';
import { buildCli, type CliIo } from '../../../apps/cli/src/cli.js';
import {
  InMemoryArtifactService,
  InMemoryProjectService,
  InMemoryRunService
} from '../../../apps/cli/src/services.js';
import {
  createAuthoringFlowState,
  submitGuidedAnswer
} from '../../../apps/web/src/authoringFlow.js';
import {
  createDashboardShell,
  createDeterministicDashboardClock
} from '../../../apps/web/src/app.js';
import { buildRunDetailView } from '../../../apps/web/src/runViews.js';

const tempDirs: string[] = [];

const SPEC_FIXTURE = `---
specmas: v4
kind: FeatureSpec
id: spec-payments
name: Payments Pipeline
version: 1.0.0
complexity: MODERATE
maturity: 3
---
# Payments Pipeline

## Overview
End-to-end fixture pipeline for deterministic orchestration.

## Functional Requirements
- FR-001: Execute workflow tasks through a runtime adapter.
- FR-002: Persist and surface deterministic pipeline artifacts.

## Acceptance Criteria
- Pipeline execution succeeds.
- Artifacts are indexed and readable.
- Notifications dispatch for completion.
`;

const WORKFLOW_FIXTURE = `name: fixture-workflow
phases:
  - id: validate
    mode: sequential
    tasks:
      - lint-spec
      - gate-check
    gates:
      - G1
      - G2
  - id: implement
    mode: parallel
    tasks:
      - implement-fr-001
      - implement-fr-002
    gates:
      - G3
`;

interface RuntimeTaskOutput {
  taskId: string;
  sandboxId: string;
  stdout: string;
  stderr: string;
  logs: string[];
}

const runtimeSandboxIds = new Set<string>();
const hostCommandExecutor = createNodeCommandExecutor();

function parseKeyValueLines(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex < 0) {
          return [line, ''] as const;
        }

        return [
          line.slice(0, separatorIndex),
          line.slice(separatorIndex + 1)
        ] as const;
      })
  );
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

function createMemoryIo(): CliIo & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    write(message: string) {
      output.push(message);
    },
    writeError(message: string) {
      errors.push(message);
    }
  };
}

async function createFixtureProject(): Promise<{
  projectRoot: string;
  specPath: string;
  workflowPath: string;
}> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'specmas-fixture-project-'));
  tempDirs.push(projectRoot);

  const specsDir = join(projectRoot, 'specs');
  await mkdir(specsDir, { recursive: true });
  const specPath = join(specsDir, 'payments.md');
  const workflowPath = join(projectRoot, 'workflow.yml');

  await writeFile(specPath, SPEC_FIXTURE, 'utf8');
  await writeFile(workflowPath, WORKFLOW_FIXTURE, 'utf8');

  return {
    projectRoot,
    specPath,
    workflowPath
  };
}

afterEach(async () => {
  const sandboxesToCleanup = [...runtimeSandboxIds];
  runtimeSandboxIds.clear();

  await forceRemoveSandboxes(sandboxesToCleanup);
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('fixture project e2e pipeline', () => {
  it('executes a real-runtime workflow end-to-end', async () => {
    const runId = 'run-fixture-0001';
    const { projectRoot, specPath, workflowPath } = await createFixtureProject();

    const specMarkdown = await readFile(specPath, 'utf8');
    const parsedSpec = parseSpecDocument(specMarkdown);

    expect(parsedSpec.frontMatter.id).toBe('spec-payments');
    expect(parsedSpec.sections).toEqual(['Overview', 'Functional Requirements', 'Acceptance Criteria']);
    expect(parsedSpec.body).toContain('FR-001');

    const resolvedConfig = resolveConfigPrecedence({
      global: {
        global: {
          default_timeout_seconds: 900,
          log_level: 'info'
        }
      },
      project: {
        project: {
          project_id: 'fixture-project',
          workspace_root: projectRoot,
          agents: {
            default_agent: 'agent-codex',
            fallback_chain: ['agent-claude-code'],
            overrides: {}
          },
          workflow: {
            max_parallel_phases: 2,
            required_gates: ['G1', 'G2', 'G3']
          },
          notifications: {
            enabled: true,
            channels: ['slack']
          },
          secrets: {}
        }
      },
      env: {
        project: {
          agents: {
            default_agent: 'agent-claude-code'
          }
        }
      },
      cli: {
        global: {
          default_timeout_seconds: 120
        }
      },
      issueLabel: {
        project: {
          agents: {
            default_agent: 'agent-codex',
            fallback_chain: ['agent-claude-code', 'agent-gemini-cli'],
            overrides: {}
          }
        }
      }
    });

    expect(resolvedConfig.global.default_timeout_seconds).toBe(120);
    expect(resolvedConfig.project.agents.default_agent).toBe('agent-codex');
    expect(resolvedConfig.project.agents.fallback_chain).toEqual([
      'agent-claude-code',
      'agent-gemini-cli'
    ]);

    const workflowSource = await readFile(workflowPath, 'utf8');
    const workflowParsed = parseWorkflowYaml(workflowSource);
    expect(workflowParsed.diagnostics).toEqual([]);
    expect(workflowParsed.workflow?.name).toBe('fixture-workflow');

    const workflow = workflowParsed.workflow;
    expect(workflow).not.toBeNull();
    if (!workflow) {
      throw new Error('Expected workflow fixture to parse');
    }

    const routingDecision = selectAdapter(
      {
        role: 'implement',
        preferredOrder: ['agent-codex', 'agent-claude-code']
      },
      [
        {
          adapterId: 'agent-claude-code',
          supportsRoles: ['implement', 'test'],
          healthy: true,
          priority: 2
        },
        {
          adapterId: 'agent-codex',
          supportsRoles: ['implement', 'test', 'review'],
          healthy: true,
          priority: 5
        },
        {
          adapterId: 'agent-gemini-cli',
          supportsRoles: ['implement'],
          healthy: false,
          priority: 1
        }
      ]
    );

    expect(routingDecision.selectedAdapterId).toBe('agent-codex');
    expect(routingDecision.fallbackChain).toEqual(['agent-claude-code']);
    expect(routingDecision.explanation).toContain('Skipped unhealthy adapters: agent-gemini-cli');

    const adapter = new CodexAdapter();
    const executionPlan = adapter.createExecutionPlan({
      role: 'implement',
      prompt: `Implement ${parsedSpec.frontMatter.id}`,
      cwd: projectRoot,
      timeoutSeconds: resolvedConfig.global.default_timeout_seconds,
      credentials: {
        OPENAI_API_KEY: 'fixture-openai-key'
      },
      env: {
        SPECMAS_RUN_ID: runId
      }
    });

    expect(executionPlan.command.slice(0, 4)).toEqual(['codex', 'exec', '--cd', projectRoot]);
    expect(executionPlan.env.SPECMAS_AGENT_ID).toBe('agent-codex');
    expect(executionPlan.env.SPECMAS_AGENT_ROLE).toBe('implement');
    expect(executionPlan.redactedEnvKeys).toEqual(['OPENAI_API_KEY']);

    const runtimeAdapter = createLocalDockerOpenHandsRuntimeAdapter();
    const runtimeSandboxConfig: SandboxConfig = {
      image: 'nginx:alpine',
      workspacePath: projectRoot,
      cpuLimit: 1,
      memoryMb: 512,
      networkEnabled: false
    };
    const runtimeTaskCommand = [
      '/bin/sh',
      '-lc',
      [
        'printf "task=%s\\n" "$SPECMAS_TASK_ID"',
        'printf "run=%s\\n" "$SPECMAS_RUN_ID"',
        'printf "agent=%s\\n" "$SPECMAS_AGENT_ID"',
        'printf "role=%s\\n" "$SPECMAS_AGENT_ROLE"',
        'printf "openai=%s\\n" "$OPENAI_API_KEY"'
      ].join('; ')
    ];

    const workflowResult = await executeWorkflow(workflow, {
      async runTask(taskId: string) {
        const lifecycle = await runLifecycle(runtimeAdapter, {
          sandboxConfig: runtimeSandboxConfig,
          command: runtimeTaskCommand,
          env: {
            ...executionPlan.env,
            SPECMAS_TASK_ID: taskId
          }
        });
        runtimeSandboxIds.add(lifecycle.sandboxId);

        return {
          ok: lifecycle.result.exitCode === 0,
          output: JSON.stringify({
            taskId,
            sandboxId: lifecycle.sandboxId,
            stdout: lifecycle.result.stdout,
            stderr: lifecycle.result.stderr,
            logs: lifecycle.logs.map((log) => log.message)
          })
        };
      }
    });

    expect(workflowResult.status).toBe('passed');
    expect(workflowResult.phases.map((phase) => phase.phaseId)).toEqual(['validate', 'implement']);
    expect(workflowResult.phases[0]?.tasks.map((task) => task.taskId)).toEqual([
      'lint-spec',
      'gate-check'
    ]);
    expect(workflowResult.phases[1]?.tasks.map((task) => task.taskId).sort()).toEqual([
      'implement-fr-001',
      'implement-fr-002'
    ]);

    const runtimeTaskOutputs = workflowResult.phases
      .flatMap((phase) => phase.tasks)
      .map((task) => JSON.parse(task.output) as RuntimeTaskOutput);
    expect(runtimeTaskOutputs).toHaveLength(4);
    expect(runtimeTaskOutputs.map((output) => output.taskId).sort()).toEqual([
      'gate-check',
      'implement-fr-001',
      'implement-fr-002',
      'lint-spec'
    ]);
    runtimeTaskOutputs.forEach((output) => {
      const envEcho = parseKeyValueLines(output.stdout);
      expect(envEcho).toMatchObject({
        task: output.taskId,
        run: runId,
        agent: 'agent-codex',
        role: 'implement',
        openai: 'fixture-openai-key'
      });
      expect(output.stderr).toBe('');
      expect(output.logs).toEqual([]);
    });
    expect(runtimeSandboxIds.size).toBe(4);

    const sandboxStates = await Promise.all(
      [...runtimeSandboxIds].map(async (sandboxId) => ({
        sandboxId,
        exists: await sandboxExists(sandboxId)
      }))
    );
    sandboxStates.forEach((sandboxState) => {
      expect(sandboxState.exists).toBe(false);
    });

    const issuePayloads = decomposeRequirements([
      {
        id: 'FR-001',
        title: 'Execute runtime task lifecycle',
        description: 'Pipeline tasks should run through a container runtime.',
        acceptanceCriteria: ['Task executes', 'Runtime logs are captured']
      },
      {
        id: 'FR-002',
        title: 'Publish completion notifications',
        description: 'Pipeline emits completion notifications and status comments.',
        dependsOn: ['FR-001', 'FR-001'],
        acceptanceCriteria: ['Notification is dispatched']
      }
    ]);

    expect(issuePayloads).toHaveLength(2);
    expect(issuePayloads[0]?.title).toBe('[FR-001] Execute runtime task lifecycle');
    expect(issuePayloads[1]?.dependencies).toEqual(['FR-001']);
    expect(issuePayloads[1]?.body).toContain('## Acceptance Criteria');

    const startedComment = transitionIssueState({
      from: 'todo',
      to: 'started',
      actor: routingDecision.selectedAdapterId ?? 'unknown-agent',
      summary: `Executing ${workflowResult.workflowName}`
    });
    const passedComment = transitionIssueState({
      from: 'started',
      to: 'passed',
      actor: routingDecision.selectedAdapterId ?? 'unknown-agent',
      summary: `Completed ${workflowResult.workflowName}`
    });

    expect(startedComment.comment).toContain('### STARTED');
    expect(passedComment.comment).toContain('### PASS');
    expect(passedComment.comment).toContain('actor: agent-codex');

    const artifactManager = new FileSystemArtifactManager(join(projectRoot, 'artifacts'));
    const workflowManifest = await artifactManager.writeArtifact({
      artifactId: 'workflow-result',
      runId,
      phaseId: 'report',
      taskId: 'pipeline',
      kind: 'json',
      content: JSON.stringify(workflowResult, null, 2),
      createdAt: '2026-02-19T00:00:10.000Z'
    });
    const transitionManifest = await artifactManager.writeArtifact({
      artifactId: 'issue-transition',
      runId,
      phaseId: 'report',
      taskId: 'pipeline',
      kind: 'report',
      content: passedComment.comment,
      createdAt: '2026-02-19T00:00:11.000Z'
    });

    const indexedPaths = await artifactManager.listTaskArtifacts(runId, 'report', 'pipeline');
    expect(indexedPaths).toEqual([
      `run-fixture-0001/report/pipeline/issue-transition.md`,
      `run-fixture-0001/report/pipeline/workflow-result.json`
    ]);

    const workflowArtifactRaw = await artifactManager.readArtifact(workflowManifest.path);
    expect(JSON.parse(workflowArtifactRaw)).toMatchObject({
      workflowName: 'fixture-workflow',
      status: 'passed'
    });
    expect(await artifactManager.readArtifact(transitionManifest.path)).toContain('### PASS');

    const notifications = new NotificationsEngine([
      new SlackChannelAdapter(),
      new GitHubChannelAdapter()
    ]);
    const notificationResult = await notifications.dispatch(
      {
        id: 'event-0001',
        type: 'run.completed',
        severity: 'info',
        title: 'Fixture pipeline complete',
        body: 'run complete',
        runId,
        createdAt: '2026-02-19T00:00:12.000Z'
      },
      [
        {
          id: 'rule-slack',
          eventTypes: ['run.completed'],
          minimumSeverity: 'info',
          channels: [{ channel: 'slack', target: '#specmas-alerts' }]
        },
        {
          id: 'rule-github',
          eventTypes: ['run.completed'],
          minimumSeverity: 'info',
          channels: [{ channel: 'github', target: 'issue:42' }]
        }
      ]
    );

    expect(notificationResult.matchedRuleIds).toEqual(['rule-github', 'rule-slack']);
    expect(notificationResult.deliveries).toHaveLength(2);
    expect(notificationResult.deliveries.every((delivery) => delivery.ok)).toBe(true);
    expect(notificationResult.deliveries[0]?.message).toContain('Fixture pipeline complete');

    const apiLogEntries: StructuredLogEntry[] = [];
    const app = createServer({
      logger: {
        info(entry: StructuredLogEntry) {
          apiLogEntries.push(entry);
        }
      },
      correlationIdGenerator: createDeterministicCorrelationIdGenerator('fixture-corr'),
      sessionService: new InMemoryConversationSessionService(
        createDeterministicSessionIdGenerator('fixture-session'),
        createDeterministicSessionClock('2026-02-19T01:00:00.000Z', 1000)
      )
    });

    const createSessionResponse = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        specId: parsedSpec.frontMatter.id,
        seedMessage: 'Start fixture draft'
      }
    });

    expect(createSessionResponse.statusCode).toBe(201);
    expect(createSessionResponse.json()).toMatchObject({
      id: 'fixture-session-0001',
      specId: 'spec-payments',
      mode: 'guided'
    });

    const runEventResponse = await app.inject({
      method: 'POST',
      url: `/runs/${runId}/events`,
      headers: {
        'x-role': 'operator',
        'x-correlation-id': 'fixture-correlation-0001'
      },
      payload: {
        event: 'completed'
      }
    });

    expect(runEventResponse.statusCode).toBe(200);
    expect(runEventResponse.json()).toEqual({
      status: 'logged',
      correlationId: 'fixture-correlation-0001',
      runId,
      event: 'completed'
    });
    expect(apiLogEntries.some((entry) => entry.type === 'run_event')).toBe(true);

    const dashboard = createDashboardShell(
      {
        async ping() {
          const health = await app.inject({ method: 'GET', url: '/health' });
          return health.json<{ status: string }>();
        }
      },
      createDeterministicDashboardClock('2026-02-19T02:00:00.000Z', 1000)
    );
    const dashboardState = await dashboard.load();

    expect(dashboardState.apiHealthy).toBe(true);
    expect(dashboardState.lastHealthCheckAt).toBe('2026-02-19T02:00:00.000Z');

    const memoryIo = createMemoryIo();
    const projectService = new InMemoryProjectService();
    const runService = new InMemoryRunService();
    const artifactService = new InMemoryArtifactService([
      {
        runId,
        projectId: 'fixture-project',
        ageDays: 0,
        files: Object.fromEntries(
          indexedPaths.map((path) => [path, `artifact:${path}`])
        )
      }
    ]);

    async function runCli(argv: string[]): Promise<void> {
      const cli = buildCli({
        io: memoryIo,
        projectService,
        runService,
        artifactService
      });
      await cli.parseAsync(argv, { from: 'user' });
    }

    await runCli([
      'project',
      'create',
      'fixture-project',
      '--key',
      'FX',
      '--name',
      'Fixture Project',
      '--repo',
      projectRoot,
      '--format',
      'json'
    ]);
    await runCli([
      'run',
      'start',
      '--project',
      'fixture-project',
      '--spec',
      specPath,
      '--run-id',
      runId,
      '--format',
      'json'
    ]);
    await runCli(['artifact', 'list', runId, '--format', 'json']);

    expect(memoryIo.errors).toEqual([]);
    expect(JSON.parse(memoryIo.output[0] ?? '{}')).toEqual({
      id: 'fixture-project',
      key: 'FX',
      name: 'Fixture Project',
      repoPath: projectRoot
    });
    expect(JSON.parse(memoryIo.output[1] ?? '{}')).toMatchObject({
      id: runId,
      projectId: 'fixture-project',
      status: 'running'
    });
    expect(JSON.parse(memoryIo.output[2] ?? '[]')).toEqual(indexedPaths);

    let authoringState = createAuthoringFlowState('guided');
    authoringState = submitGuidedAnswer(authoringState, 'Fixture overview complete');
    expect(authoringState.activeSectionId).toBe('functional-requirements');

    const runDetail = buildRunDetailView(
      {
        id: runId,
        projectId: 'fixture-project',
        status: 'passed',
        startedAt: '2026-02-19T00:00:00.000Z',
        sourceBranch: 'main',
        workingBranch: `specmas/${runId}/issue-1`,
        integrationBranch: `specmas/${runId}/integration`,
        releaseBranch: `specmas/${runId}/release`,
        mergeStatus: 'awaiting_human_approval'
      },
      [
        {
          id: 'phase-1',
          runId,
          name: 'validate',
          status: 'passed',
          sequence: 1
        },
        {
          id: 'phase-2',
          runId,
          name: 'implement',
          status: 'passed',
          sequence: 2
        }
      ]
    );
    expect(runDetail.timeline.map((entry) => entry.name)).toEqual(['validate', 'implement']);
    expect(runDetail.phaseCounts.passed).toBe(2);

    await app.close();
  });
});
