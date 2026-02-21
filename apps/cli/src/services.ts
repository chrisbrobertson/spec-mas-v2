import { spawn } from 'node:child_process';

export interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  repoPath: string;
}

export class InMemoryProjectService {
  private readonly projects = new Map<string, ProjectRecord>();

  constructor(seed: ProjectRecord[] = []) {
    for (const project of seed) {
      this.projects.set(project.id, project);
    }
  }

  list(): ProjectRecord[] {
    return Array.from(this.projects.values()).sort((left, right) => {
      const byKey = left.key.localeCompare(right.key);
      return byKey !== 0 ? byKey : left.id.localeCompare(right.id);
    });
  }

  show(projectId: string): ProjectRecord {
    const project = this.projects.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return project;
  }

  create(project: ProjectRecord): ProjectRecord {
    if (this.projects.has(project.id)) {
      throw new Error(`Project already exists: ${project.id}`);
    }

    this.projects.set(project.id, project);
    return project;
  }

  remove(projectId: string): boolean {
    return this.projects.delete(projectId);
  }
}

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunRecord {
  id: string;
  projectId: string;
  specPath: string;
  status: RunStatus;
}

export interface RunStartInput {
  projectId: string;
  specPath: string;
  runId?: string;
}

function padCounter(value: number): string {
  return value.toString().padStart(4, '0');
}

export class InMemoryRunService {
  private readonly runs = new Map<string, RunRecord>();
  private counter = 0;

  constructor(seed: RunRecord[] = []) {
    for (const run of seed) {
      this.runs.set(run.id, run);
      this.counter += 1;
    }
  }

  start(input: RunStartInput): RunRecord {
    const runId = input.runId ?? `run-${padCounter(this.counter + 1)}`;
    if (this.runs.has(runId)) {
      throw new Error(`Run already exists: ${runId}`);
    }

    this.counter += 1;
    const run: RunRecord = {
      id: runId,
      projectId: input.projectId,
      specPath: input.specPath,
      status: 'running'
    };

    this.runs.set(runId, run);
    return run;
  }

  status(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return run;
  }

  cancel(runId: string): RunRecord {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    if (run.status === 'cancelled') {
      return run;
    }

    const cancelled: RunRecord = {
      ...run,
      status: 'cancelled'
    };

    this.runs.set(runId, cancelled);
    return cancelled;
  }
}

export interface ArtifactRunRecord {
  runId: string;
  projectId: string;
  ageDays: number;
  files: Record<string, string>;
}

export interface ArtifactDownloadResult {
  outputDir: string;
  files: string[];
}

export interface ArtifactCleanResult {
  removedRuns: string[];
}

function buildMissingRunError(runId: string): Error {
  return new Error(`Run not found: ${runId}`);
}

export class InMemoryArtifactService {
  private readonly runs = new Map<string, ArtifactRunRecord>();

  constructor(seed: ArtifactRunRecord[] = []) {
    for (const run of seed) {
      this.runs.set(run.runId, run);
    }
  }

  list(runId: string): string[] {
    const run = this.runs.get(runId);
    if (!run) {
      throw buildMissingRunError(runId);
    }

    return Object.keys(run.files).sort((left, right) => left.localeCompare(right));
  }

  show(runId: string, artifactPath: string): string {
    const run = this.runs.get(runId);
    if (!run) {
      throw buildMissingRunError(runId);
    }

    const artifact = run.files[artifactPath];
    if (artifact === undefined) {
      throw new Error(`Artifact not found: ${runId}/${artifactPath}`);
    }

    return artifact;
  }

  download(
    runId: string,
    options: {
      artifactPath?: string;
      outputDir: string;
      downloadAll: boolean;
    }
  ): ArtifactDownloadResult {
    const run = this.runs.get(runId);
    if (!run) {
      throw buildMissingRunError(runId);
    }

    if (options.downloadAll) {
      return {
        outputDir: options.outputDir,
        files: Object.keys(run.files).sort((left, right) => left.localeCompare(right))
      };
    }

    if (!options.artifactPath) {
      throw new Error('artifactPath is required unless --all is provided');
    }

    if (run.files[options.artifactPath] === undefined) {
      throw new Error(`Artifact not found: ${runId}/${options.artifactPath}`);
    }

    return {
      outputDir: options.outputDir,
      files: [options.artifactPath]
    };
  }

  diff(leftRunId: string, rightRunId: string, artifactPath: string): string {
    const left = this.runs.get(leftRunId);
    if (!left) {
      throw buildMissingRunError(leftRunId);
    }

    const right = this.runs.get(rightRunId);
    if (!right) {
      throw buildMissingRunError(rightRunId);
    }

    const before = left.files[artifactPath] ?? '';
    const after = right.files[artifactPath] ?? '';

    return [
      `--- ${leftRunId}/${artifactPath}`,
      `+++ ${rightRunId}/${artifactPath}`,
      `- ${before}`,
      `+ ${after}`
    ].join('\n');
  }

  open(runId: string, artifactPath?: string): string {
    const run = this.runs.get(runId);
    if (!run) {
      throw buildMissingRunError(runId);
    }

    if (artifactPath && run.files[artifactPath] === undefined) {
      throw new Error(`Artifact not found: ${runId}/${artifactPath}`);
    }

    const path = artifactPath ?? '';
    return `http://localhost:3000/artifacts/${runId}/${path}`;
  }

  clean(options: { projectId?: string; olderThanDays: number }): ArtifactCleanResult {
    const removedRuns: string[] = [];

    for (const [runId, run] of this.runs.entries()) {
      const projectMatches = options.projectId ? run.projectId === options.projectId : true;
      const ageMatches = run.ageDays > options.olderThanDays;

      if (projectMatches && ageMatches) {
        this.runs.delete(runId);
        removedRuns.push(runId);
      }
    }

    removedRuns.sort((left, right) => left.localeCompare(right));
    return { removedRuns };
  }
}

export const SUPPORTED_AGENT_PROVIDERS = ['codex', 'claude', 'gemini'] as const;
export type AgentProvider = (typeof SUPPORTED_AGENT_PROVIDERS)[number];

export const AGENT_EXECUTION_MODES = ['local_cli', 'remote_api'] as const;
export type AgentExecutionMode = (typeof AGENT_EXECUTION_MODES)[number];

export interface AgentGenerationInput {
  agent: AgentProvider;
  prompt: string;
  mode?: AgentExecutionMode;
  remoteApiUrl?: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface AgentGenerationResult {
  agent: AgentProvider;
  mode: AgentExecutionMode;
  output: string;
  command?: string[];
  remoteApiUrl?: string;
  statusCode?: number;
}

type AdapterRole = 'implement' | 'test' | 'review';

interface AdapterExecutionRequest {
  role: AdapterRole;
  prompt: string;
  cwd: string;
  timeoutSeconds: number;
  credentials?: Record<string, string>;
  env?: Record<string, string>;
}

interface AdapterExecutionPlan {
  command: string[];
  env: Record<string, string>;
  redactedEnvKeys: string[];
}

interface AdapterContract {
  readonly requiredCredentialEnv: readonly string[];
  createExecutionPlan(request: AdapterExecutionRequest): AdapterExecutionPlan;
}

type AdapterConstructor = new () => AdapterContract;

interface AdapterModuleDefinition {
  exportName: string;
  moduleSpecifiers: readonly string[];
}

const AGENT_ADAPTER_MODULES: Record<AgentProvider, AdapterModuleDefinition> = {
  codex: {
    exportName: 'CodexAdapter',
    moduleSpecifiers: ['../../../packages/adapters/dist/codex.js', '../../../packages/adapters/src/codex.js']
  },
  claude: {
    exportName: 'ClaudeAdapter',
    moduleSpecifiers: ['../../../packages/adapters/dist/claude.js', '../../../packages/adapters/src/claude.js']
  },
  gemini: {
    exportName: 'GeminiAdapter',
    moduleSpecifiers: ['../../../packages/adapters/dist/gemini.js', '../../../packages/adapters/src/gemini.js']
  }
};

const loadedAdapterConstructors = new Map<AgentProvider, Promise<AdapterConstructor>>();

const ADAPTER_PLACEHOLDER_CREDENTIAL_PREFIX = '__specmas_cli_placeholder_credential__';
const DEFAULT_TIMEOUT_SECONDS = 300;
const LOCAL_EXECUTION_ROLE: AdapterRole = 'implement';

interface ResolvedAdapterCredentials {
  credentials: Record<string, string>;
  placeholderKeys: string[];
}

function resolveAdapterCredentials(requiredKeys: readonly string[]): ResolvedAdapterCredentials {
  const credentials: Record<string, string> = {};
  const placeholderKeys: string[] = [];

  for (const key of requiredKeys) {
    const value = process.env[key];
    if (value && value.length > 0) {
      credentials[key] = value;
      continue;
    }

    credentials[key] = `${ADAPTER_PLACEHOLDER_CREDENTIAL_PREFIX}${key}`;
    placeholderKeys.push(key);
  }

  return {
    credentials,
    placeholderKeys
  };
}

function stripPlaceholderCredentials(plan: AdapterExecutionPlan, placeholderKeys: readonly string[]): AdapterExecutionPlan {
  if (placeholderKeys.length === 0) {
    return plan;
  }

  const env = { ...plan.env };
  for (const key of placeholderKeys) {
    delete env[key];
  }

  return {
    ...plan,
    env
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function importAdapterModule(definition: AdapterModuleDefinition, agent: AgentProvider): Promise<AdapterConstructor> {
  let latestError: string | undefined;
  for (const moduleSpecifier of definition.moduleSpecifiers) {
    try {
      const loaded = (await import(moduleSpecifier)) as Record<string, unknown>;
      const candidate = loaded[definition.exportName];
      if (typeof candidate === 'function') {
        return candidate as AdapterConstructor;
      }

      latestError = `Missing adapter export: ${definition.exportName}`;
    } catch (error) {
      latestError = formatError(error);
    }
  }

  throw new Error(`Failed to load adapter module for ${agent}${latestError ? `: ${latestError}` : ''}`);
}

async function getAdapterConstructor(agent: AgentProvider): Promise<AdapterConstructor> {
  const definition = AGENT_ADAPTER_MODULES[agent];
  if (!definition) {
    throw new Error(`Unsupported agent: ${agent}`);
  }

  const existing = loadedAdapterConstructors.get(agent);
  if (existing) {
    return existing;
  }

  const loader = importAdapterModule(definition, agent);
  loadedAdapterConstructors.set(agent, loader);
  return loader;
}

async function createAdapter(agent: AgentProvider): Promise<AdapterContract> {
  const Adapter = await getAdapterConstructor(agent);
  return new Adapter();
}

function toTimeoutSeconds(timeoutMs?: number): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_SECONDS;
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

async function createLocalExecutionPlan(
  agent: AgentProvider,
  prompt: string,
  workingDirectory: string,
  timeoutMs?: number
): Promise<AdapterExecutionPlan> {
  const adapter = await createAdapter(agent);
  const resolvedCredentials = resolveAdapterCredentials(adapter.requiredCredentialEnv);
  const request: AdapterExecutionRequest = {
    role: LOCAL_EXECUTION_ROLE,
    prompt,
    cwd: workingDirectory,
    timeoutSeconds: toTimeoutSeconds(timeoutMs),
    credentials: resolvedCredentials.credentials
  };

  const plan = adapter.createExecutionPlan(request);
  return stripPlaceholderCredentials(plan, resolvedCredentials.placeholderKeys);
}

export interface CommandExecutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandExecutionOptions
) => Promise<CommandExecutionResult>;

function createDefaultCommandRunner(): CommandRunner {
  return async (command, args, options = {}) => {
    return new Promise<CommandExecutionResult>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env
        }
      });

      let stdout = '';
      let stderr = '';

      const timeoutHandle =
        options.timeoutMs !== undefined
          ? setTimeout(() => {
              child.kill('SIGTERM');
            }, options.timeoutMs)
          : undefined;

      child.stdout?.on('data', (chunk: string | Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk: string | Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        reject(new Error(`Failed to start ${command}: ${error.message}`));
      });

      child.on('close', (exitCode) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        resolve({
          exitCode: exitCode ?? 1,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd()
        });
      });
    });
  };
}

export type HttpFetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface AgentGenerationServiceOptions {
  commandRunner?: CommandRunner;
  fetcher?: HttpFetcher;
}

export interface AgentGenerationServiceLike {
  generate(input: AgentGenerationInput): Promise<AgentGenerationResult>;
}

function parseRemoteApiOutput(response: Response, responseBody: string): string {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return responseBody;
  }

  if (responseBody.trim().length === 0) {
    return '';
  }

  try {
    const parsed = JSON.parse(responseBody) as unknown;
    if (typeof parsed === 'string') {
      return parsed;
    }

    if (typeof parsed === 'object' && parsed !== null) {
      const parsedRecord = parsed as Record<string, unknown>;
      const output = parsedRecord.output;
      if (typeof output === 'string') {
        return output;
      }

      const result = parsedRecord.result;
      if (typeof result === 'string') {
        return result;
      }

      const message = parsedRecord.message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return JSON.stringify(parsed);
  } catch {
    return responseBody;
  }
}

export class AgentGenerationService implements AgentGenerationServiceLike {
  private readonly commandRunner: CommandRunner;
  private readonly fetcher: HttpFetcher;

  constructor(options: AgentGenerationServiceOptions = {}) {
    this.commandRunner = options.commandRunner ?? createDefaultCommandRunner();
    this.fetcher = options.fetcher ?? fetch;
  }

  async generate(input: AgentGenerationInput): Promise<AgentGenerationResult> {
    const mode = input.mode ?? 'local_cli';
    if (mode === 'local_cli') {
      return this.generateWithLocalCli({ ...input, mode });
    }

    return this.generateWithRemoteApi({ ...input, mode });
  }

  private async generateWithLocalCli(input: AgentGenerationInput & { mode: 'local_cli' }): Promise<AgentGenerationResult> {
    const workingDirectory = input.cwd ?? process.cwd();
    const plan = await createLocalExecutionPlan(input.agent, input.prompt, workingDirectory, input.timeoutMs);
    const [command, ...args] = plan.command;
    if (!command) {
      throw new Error(`Invalid execution plan for agent: ${input.agent}`);
    }

    const execution = await this.commandRunner(command, args, {
      cwd: workingDirectory,
      env: plan.env,
      timeoutMs: input.timeoutMs
    });

    if (execution.exitCode !== 0) {
      const details = execution.stderr || execution.stdout;
      throw new Error(`${command} exited with code ${execution.exitCode}${details ? `: ${details}` : ''}`);
    }

    return {
      agent: input.agent,
      mode: 'local_cli',
      output: execution.stdout,
      command: plan.command
    };
  }

  private async generateWithRemoteApi(
    input: AgentGenerationInput & { mode: 'remote_api' }
  ): Promise<AgentGenerationResult> {
    if (!input.remoteApiUrl) {
      throw new Error('remoteApiUrl is required when mode=remote_api');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.remoteApiUrl);
    } catch {
      throw new Error(`Invalid remoteApiUrl: ${input.remoteApiUrl}`);
    }

    const response = await this.fetcher(parsedUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        agent: input.agent,
        prompt: input.prompt,
        mode: input.mode,
        cwd: input.cwd ?? process.cwd()
      })
    });

    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(
        `Remote API request failed (${response.status})${responseBody ? `: ${responseBody}` : ''}`
      );
    }

    return {
      agent: input.agent,
      mode: 'remote_api',
      output: parseRemoteApiOutput(response, responseBody),
      remoteApiUrl: parsedUrl.toString(),
      statusCode: response.status
    };
  }
}
