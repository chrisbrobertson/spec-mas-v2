import { spawn } from 'node:child_process';
import type { RuntimeExecutionResult, RuntimeStreamEvent, SandboxConfig } from './contracts.js';

export interface CommandExecutionRequest {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandExecutor = (request: CommandExecutionRequest) => Promise<CommandExecutionResult>;

export interface OpenHandsProvisionResult {
  sandboxId: string;
}

export interface OpenHandsExecuteRequest {
  sandboxId: string;
  command: string[];
  env?: Record<string, string>;
}

export interface OpenHandsClient {
  provision(config: SandboxConfig): Promise<OpenHandsProvisionResult>;
  execute(request: OpenHandsExecuteRequest): Promise<RuntimeExecutionResult>;
  stream(sandboxId: string, onEvent: (event: RuntimeStreamEvent) => void): Promise<void>;
  teardown(sandboxId: string): Promise<void>;
}

export interface LocalDockerOpenHandsClientOptions {
  executor?: CommandExecutor;
  now?: () => Date;
}

function buildCommandFailureMessage(prefix: string, result: CommandExecutionResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`;
  return `${prefix}: ${detail}`;
}

function splitOutputLines(output: string): string[] {
  return output.split(/\r?\n/u).filter((line) => line.length > 0);
}

function toDockerEnvFlags(env?: Record<string, string>): string[] {
  if (!env) {
    return [];
  }

  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) => ['-e', `${key}=${value}`]);
}

export function createNodeCommandExecutor(): CommandExecutor {
  return async (request) =>
    new Promise<CommandExecutionResult>((resolve, reject) => {
      const child = spawn(request.command, request.args, {
        cwd: request.cwd,
        env: request.env ? { ...process.env, ...request.env } : process.env
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      child.once('error', (error) => {
        reject(error);
      });
      child.once('close', (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr
        });
      });
    });
}

export class LocalDockerOpenHandsClient implements OpenHandsClient {
  private readonly executor: CommandExecutor;
  private readonly now: () => Date;

  constructor(options: LocalDockerOpenHandsClientOptions = {}) {
    this.executor = options.executor ?? createNodeCommandExecutor();
    this.now = options.now ?? (() => new Date());
  }

  async provision(config: SandboxConfig): Promise<OpenHandsProvisionResult> {
    const args = [
      'run',
      '-d',
      '--cpus',
      String(config.cpuLimit),
      '--memory',
      `${config.memoryMb}m`,
      '--workdir',
      config.workspacePath,
      '-v',
      `${config.workspacePath}:${config.workspacePath}`
    ];

    if (!config.networkEnabled) {
      args.push('--network', 'none');
    }

    args.push(config.image, 'sleep', 'infinity');

    const result = await this.executor({
      command: 'docker',
      args
    });
    if (result.exitCode !== 0) {
      throw new Error(buildCommandFailureMessage('OpenHands docker provision failed', result));
    }

    const sandboxId = result.stdout.trim();
    if (!sandboxId) {
      throw new Error('OpenHands docker provision returned an empty sandbox id');
    }

    return { sandboxId };
  }

  async execute(request: OpenHandsExecuteRequest): Promise<RuntimeExecutionResult> {
    if (request.command.length === 0) {
      throw new Error('OpenHands command must not be empty');
    }

    const startedAt = this.now().toISOString();
    const result = await this.executor({
      command: 'docker',
      args: ['exec', ...toDockerEnvFlags(request.env), request.sandboxId, ...request.command]
    });
    const completedAt = this.now().toISOString();

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      completedAt
    };
  }

  async stream(sandboxId: string, onEvent: (event: RuntimeStreamEvent) => void): Promise<void> {
    const result = await this.executor({
      command: 'docker',
      args: ['logs', sandboxId]
    });
    if (result.exitCode !== 0) {
      throw new Error(buildCommandFailureMessage('OpenHands docker log stream failed', result));
    }

    let sequence = 1;
    for (const message of splitOutputLines(result.stdout)) {
      onEvent({
        sequence,
        stream: 'stdout',
        message
      });
      sequence += 1;
    }
    for (const message of splitOutputLines(result.stderr)) {
      onEvent({
        sequence,
        stream: 'stderr',
        message
      });
      sequence += 1;
    }
  }

  async teardown(sandboxId: string): Promise<void> {
    const result = await this.executor({
      command: 'docker',
      args: ['rm', '-f', sandboxId]
    });
    if (result.exitCode !== 0) {
      throw new Error(buildCommandFailureMessage('OpenHands docker teardown failed', result));
    }
  }
}
