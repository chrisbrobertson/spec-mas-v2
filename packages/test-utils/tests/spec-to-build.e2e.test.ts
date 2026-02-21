import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CodexAdapter } from '../../adapters/src/codex.js';
import { parseSpecDocument } from '../../core/src/specParser.js';
import {
  createLocalDockerOpenHandsRuntimeAdapter,
  createNodeCommandExecutor,
  type SandboxConfig
} from '../../runtime/src/index.js';
import { runLifecycle } from '../../runtime/src/lifecycle.js';
import { executeWorkflow } from '../../workflow/src/executor.js';
import { parseWorkflowYaml } from '../../workflow/src/schema.js';

interface SpecDocumentInput {
  frontMatter: Record<string, string | number>;
  title: string;
  sections: Array<{
    heading: string;
    lines: string[];
  }>;
}

interface RuntimeTaskOutput {
  taskId: string;
  sandboxId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

const runtimeSandboxIds = new Set<string>();
const workspaceRoots: string[] = [];
const hostCommandExecutor = createNodeCommandExecutor();

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const artifactsRoot = join(repoRoot, 'artifacts');

const PHASE_IDS = [
  'validate',
  'plan',
  'adversarial_review',
  'implement',
  'test',
  'review',
  'report'
] as const;

const TASK_IDS = [
  'validate-runtime',
  'scaffold-project',
  'adversarial-checks',
  'implement-project',
  'run-tests',
  'review-project',
  'build-and-report'
] as const;

function composeSpecMarkdown(input: SpecDocumentInput): string {
  const frontMatter = Object.entries(input.frontMatter)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const sections = input.sections
    .map((section) => [`## ${section.heading}`, '', ...section.lines].join('\n'))
    .join('\n\n');

  return ['---', frontMatter, '---', `# ${input.title}`, '', sections, ''].join('\n');
}

function composeWorkflowYaml(): string {
  return [
    'name: spec-to-build-e2e',
    'phases:',
    '  - id: validate',
    '    mode: sequential',
    '    tasks:',
    '      - validate-runtime',
    '    gates:',
    '      - spec-validated',
    '  - id: plan',
    '    mode: sequential',
    '    tasks:',
    '      - scaffold-project',
    '    gates:',
    '      - workspace-planned',
    '  - id: adversarial_review',
    '    mode: sequential',
    '    tasks:',
    '      - adversarial-checks',
    '    gates:',
    '      - constraints-confirmed',
    '  - id: implement',
    '    mode: sequential',
    '    tasks:',
    '      - implement-project',
    '    gates:',
    '      - implementation-complete',
    '  - id: test',
    '    mode: sequential',
    '    tasks:',
    '      - run-tests',
    '    gates:',
    '      - tests-passed',
    '  - id: review',
    '    mode: sequential',
    '    tasks:',
    '      - review-project',
    '    gates:',
    '      - review-passed',
    '  - id: report',
    '    mode: sequential',
    '    tasks:',
    '      - build-and-report',
    '    gates:',
    '      - artifact-delivered'
  ].join('\n');
}

function shellCommand(lines: readonly string[]): string[] {
  return ['/bin/sh', '-lc', lines.join('\n')];
}

function parseKeyValueLines(output: string): Record<string, string> {
  return Object.fromEntries(
    output
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const delimiterIndex = line.indexOf('=');
        if (delimiterIndex < 0) {
          return [line, ''] as const;
        }

        return [line.slice(0, delimiterIndex), line.slice(delimiterIndex + 1)] as const;
      })
  );
}

const TASK_COMMANDS: Record<(typeof TASK_IDS)[number], string[]> = {
  'validate-runtime': shellCommand([
    'set -eu',
    'test -n "$SPECMAS_PROJECT_DIR"',
    'node --version',
    'npm --version',
    'mkdir -p "$SPECMAS_PROJECT_DIR"',
    'printf "task=%s\\n" "$SPECMAS_TASK_ID"',
    'printf "run=%s\\n" "$SPECMAS_RUN_ID"',
    'printf "agent=%s\\n" "$SPECMAS_AGENT_ID"',
    'printf "role=%s\\n" "$SPECMAS_AGENT_ROLE"'
  ]),
  'scaffold-project': shellCommand([
    'set -eu',
    'project_dir="$SPECMAS_PROJECT_DIR"',
    'mkdir -p "$project_dir" "$project_dir/src" "$project_dir/test" "$project_dir/scripts"',
    'cat > "$project_dir/package.json" <<\'JSON\'',
    '{',
    '  "name": "specmas-runtime-sample",',
    '  "version": "1.0.0",',
    '  "private": true,',
    '  "type": "module",',
    '  "scripts": {',
    '    "test": "node --test test/*.test.js",',
    '    "build": "node scripts/build.mjs"',
    '  }',
    '}',
    'JSON',
    'cat > "$project_dir/scripts/build.mjs" <<\'JS\'',
    "import { mkdir, readFile, writeFile } from 'node:fs/promises';",
    "import { join } from 'node:path';",
    '',
    'const projectRoot = process.cwd();',
    "const sourcePath = join(projectRoot, 'src', 'main.js');",
    "const distDir = join(projectRoot, 'dist');",
    'await mkdir(distDir, { recursive: true });',
    "const source = await readFile(sourcePath, 'utf8');",
    "const banner = '// build-artifact:specmas-e2e\\n';",
    "await writeFile(join(distDir, 'main.js'), `${banner}${source}`, 'utf8');",
    'JS'
  ]),
  'adversarial-checks': shellCommand([
    'set -eu',
    "node <<'NODE'",
    "const { readFileSync } = require('node:fs');",
    "const { join } = require('node:path');",
    "const packageJsonPath = join(process.env.SPECMAS_PROJECT_DIR, 'package.json');",
    "const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));",
    'if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0) {',
    "  throw new Error('Expected no runtime dependencies for deterministic execution');",
    '}',
    "if (!packageJson.scripts?.test || !packageJson.scripts?.build) {",
    "  throw new Error('Expected both test and build scripts');",
    '}',
    "console.log('adversarial_review=ok');",
    'NODE'
  ]),
  'implement-project': shellCommand([
    'set -eu',
    'project_dir="$SPECMAS_PROJECT_DIR"',
    'cat > "$project_dir/src/main.js" <<\'JS\'',
    "import { pathToFileURL } from 'node:url';",
    '',
    'export function buildGreeting(name) {',
    "  if (typeof name !== 'string') {",
    "    throw new TypeError('name must be a string');",
    '  }',
    '',
    '  const normalized = name.trim();',
    "  const target = normalized.length > 0 ? normalized : 'Anonymous';",
    '  return `Hello, ${target}!`;',
    '}',
    '',
    'if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {',
    "  const input = process.argv[2] ?? 'Spec-MAS';",
    '  console.log(buildGreeting(input));',
    '}',
    'JS',
    'cat > "$project_dir/test/main.test.js" <<\'JS\'',
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { buildGreeting } from '../src/main.js';",
    '',
    "test('returns greeting for provided name', () => {",
    "  assert.equal(buildGreeting('Spec-MAS'), 'Hello, Spec-MAS!');",
    '});',
    '',
    "test('uses Anonymous for empty names', () => {",
    "  assert.equal(buildGreeting('   '), 'Hello, Anonymous!');",
    '});',
    '',
    "test('throws for non-string names', () => {",
    '  assert.throws(() => buildGreeting(42), {',
    "    name: 'TypeError',",
    "    message: 'name must be a string'",
    '  });',
    '});',
    'JS'
  ]),
  'run-tests': shellCommand(['set -eu', 'cd "$SPECMAS_PROJECT_DIR"', 'npm test']),
  'review-project': shellCommand([
    'set -eu',
    "node <<'NODE'",
    "const { readFileSync } = require('node:fs');",
    "const { join } = require('node:path');",
    "const sourcePath = join(process.env.SPECMAS_PROJECT_DIR, 'src', 'main.js');",
    "const source = readFileSync(sourcePath, 'utf8');",
    "if (!source.includes('buildGreeting') || !source.includes('TypeError')) {",
    "  throw new Error('Implementation review failed expected checks');",
    '}',
    "console.log('review=ok');",
    'NODE'
  ]),
  'build-and-report': shellCommand([
    'set -eu',
    'cd "$SPECMAS_PROJECT_DIR"',
    'npm run build',
    'node dist/main.js "Spec-MAS" > build-output.txt',
    'printf "build_output=%s\\n" "$(cat build-output.txt)"'
  ])
};

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
  const workspaceRoot = await mkdtemp(join(artifactsRoot, 'spec-to-build-e2e-'));
  workspaceRoots.push(workspaceRoot);

  const specsDir = join(workspaceRoot, 'specs');
  await mkdir(specsDir, { recursive: true });

  return {
    workspaceRoot,
    projectRoot: join(workspaceRoot, 'sample-app'),
    specPath: join(specsDir, 'sample-app.md'),
    workflowPath: join(workspaceRoot, 'workflow.yml')
  };
}

afterEach(async () => {
  const sandboxIds = [...runtimeSandboxIds];
  runtimeSandboxIds.clear();

  await forceRemoveSandboxes(sandboxIds);
  await Promise.all(workspaceRoots.map((workspaceRoot) => rm(workspaceRoot, { recursive: true, force: true })));
  workspaceRoots.length = 0;
});

describe('spec-to-build e2e runtime workflow', () => {
  it(
    'builds a spec, runs full lifecycle, and verifies delivered artifact behavior',
    async () => {
    const runId = 'run-spec-to-build-0001';
    const { workspaceRoot, projectRoot, specPath, workflowPath } = await createWorkspace();

    const specMarkdown = composeSpecMarkdown({
      frontMatter: {
        specmas: 'v4',
        kind: 'FeatureSpec',
        id: 'spec-runtime-build',
        name: 'Runtime Build Delivery',
        version: '1.0.0',
        complexity: 'MODERATE',
        maturity: 3
      },
      title: 'Runtime Build Delivery',
      sections: [
        {
          heading: 'Overview',
          lines: ['Build a deterministic Node project entirely through runtime workflow tasks.']
        },
        {
          heading: 'Functional Requirements',
          lines: [
            '- FR-001: Scaffold a runnable project workspace.',
            '- FR-002: Implement behavior with happy/error/boundary coverage.',
            '- FR-003: Produce a deterministic build artifact via npm run build.'
          ]
        },
        {
          heading: 'Acceptance Criteria',
          lines: [
            '- AC-001: Workflow executes all lifecycle phases successfully.',
            '- AC-002: Build artifact exists and runs correctly.',
            '- AC-003: Runtime sandboxes are torn down after each task.'
          ]
        },
        {
          heading: 'Delivery Notes',
          lines: ['Use network-disabled Docker runtime and local filesystem bind mount.']
        }
      ]
    });
    await writeFile(specPath, specMarkdown, 'utf8');

    const parsedSpec = parseSpecDocument(await readFile(specPath, 'utf8'));
    expect(parsedSpec.frontMatter.id).toBe('spec-runtime-build');
    expect(parsedSpec.frontMatter.complexity).toBe('MODERATE');
    expect(parsedSpec.sections).toEqual([
      'Overview',
      'Functional Requirements',
      'Acceptance Criteria',
      'Delivery Notes'
    ]);
    expect(parsedSpec.body).toContain('FR-002');
    expect(parsedSpec.body).toContain('AC-003');

    const workflowYaml = composeWorkflowYaml();
    await writeFile(workflowPath, workflowYaml, 'utf8');

    const workflowParsed = parseWorkflowYaml(await readFile(workflowPath, 'utf8'));
    expect(workflowParsed.diagnostics).toEqual([]);
    expect(workflowParsed.workflow).not.toBeNull();

    const workflow = workflowParsed.workflow;
    if (!workflow) {
      throw new Error('Expected workflow fixture to parse');
    }
    expect(workflow.phases.map((phase) => phase.id)).toEqual([...PHASE_IDS]);

    const adapter = new CodexAdapter();
    const executionPlan = adapter.createExecutionPlan({
      role: 'implement',
      prompt: `Implement ${parsedSpec.frontMatter.id}`,
      cwd: workspaceRoot,
      timeoutSeconds: 600,
      credentials: {
        OPENAI_API_KEY: 'specmas-openai-fixture'
      },
      env: {
        SPECMAS_RUN_ID: runId,
        SPECMAS_SPEC_ID: parsedSpec.frontMatter.id
      }
    });

    expect(executionPlan.command.slice(0, 4)).toEqual(['codex', 'exec', '--cd', workspaceRoot]);
    expect(executionPlan.env.SPECMAS_AGENT_ID).toBe('agent-codex');
    expect(executionPlan.env.SPECMAS_AGENT_ROLE).toBe('implement');
    expect(executionPlan.env.SPECMAS_RUN_ID).toBe(runId);
    expect(executionPlan.redactedEnvKeys).toEqual(['OPENAI_API_KEY']);

    const runtimeAdapter = createLocalDockerOpenHandsRuntimeAdapter();
    const sandboxConfig: SandboxConfig = {
      image: 'runtime-app:latest',
      workspacePath: workspaceRoot,
      cpuLimit: 1,
      memoryMb: 1024,
      networkEnabled: false
    };

    const workflowResult = await executeWorkflow(workflow, {
      async runTask(taskId: string) {
        const command = TASK_COMMANDS[taskId as (typeof TASK_IDS)[number]];
        if (!command) {
          return {
            ok: false,
            output: '',
            error: `No runtime command configured for task "${taskId}"`
          };
        }

        const lifecycle = await runLifecycle(runtimeAdapter, {
          sandboxConfig,
          command,
          env: {
            ...executionPlan.env,
            SPECMAS_TASK_ID: taskId,
            SPECMAS_PROJECT_DIR: projectRoot
          }
        });
        runtimeSandboxIds.add(lifecycle.sandboxId);

        const taskOutput: RuntimeTaskOutput = {
          taskId,
          sandboxId: lifecycle.sandboxId,
          exitCode: lifecycle.result.exitCode,
          stdout: lifecycle.result.stdout,
          stderr: lifecycle.result.stderr
        };

        return {
          ok: lifecycle.result.exitCode === 0,
          output: JSON.stringify(taskOutput),
          error:
            lifecycle.result.exitCode === 0
              ? undefined
              : lifecycle.result.stderr || `Task "${taskId}" exited with ${lifecycle.result.exitCode}`
        };
      }
    });

    expect(workflowResult.status).toBe('passed');
    expect(workflowResult.phases.map((phase) => phase.phaseId)).toEqual([...PHASE_IDS]);
    expect(workflowResult.phases.every((phase) => phase.status === 'passed')).toBe(true);

    const taskOutputs = workflowResult.phases
      .flatMap((phase) => phase.tasks)
      .map((task) => JSON.parse(task.output) as RuntimeTaskOutput);
    expect(taskOutputs).toHaveLength(TASK_IDS.length);
    expect(taskOutputs.every((output) => output.exitCode === 0)).toBe(true);
    expect(runtimeSandboxIds.size).toBe(TASK_IDS.length);

    const validateTaskOutput = taskOutputs.find((output) => output.taskId === 'validate-runtime');
    expect(validateTaskOutput).toBeDefined();
    const validateEnvEcho = parseKeyValueLines(validateTaskOutput?.stdout ?? '');
    expect(validateEnvEcho).toMatchObject({
      task: 'validate-runtime',
      run: runId,
      agent: 'agent-codex',
      role: 'implement'
    });

    const reportTaskOutput = taskOutputs.find((output) => output.taskId === 'build-and-report');
    expect(reportTaskOutput).toBeDefined();
    expect(reportTaskOutput?.stdout).toContain('build_output=Hello, Spec-MAS!');

    const artifactPath = join(projectRoot, 'dist', 'main.js');
    await access(artifactPath);
    const artifactContents = await readFile(artifactPath, 'utf8');
    expect(artifactContents).toContain('// build-artifact:specmas-e2e');
    expect(artifactContents).toContain('export function buildGreeting');

    const runtimeBehaviorOutput = await readFile(join(projectRoot, 'build-output.txt'), 'utf8');
    expect(runtimeBehaviorOutput.trim()).toBe('Hello, Spec-MAS!');

    const hostBehaviorResult = await hostCommandExecutor({
      command: 'node',
      args: ['dist/main.js', 'Runtime'],
      cwd: projectRoot
    });
    expect(hostBehaviorResult.exitCode).toBe(0);
    expect(hostBehaviorResult.stdout.trim()).toBe('Hello, Runtime!');

    const sandboxStates = await Promise.all(
      [...runtimeSandboxIds].map(async (sandboxId) => ({
        sandboxId,
        exists: await sandboxExists(sandboxId)
      }))
    );
    sandboxStates.forEach((sandboxState) => {
      expect(sandboxState.exists).toBe(false);
    });
    },
    120_000
  );
});
