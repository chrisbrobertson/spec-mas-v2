import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SandboxConfig } from '../src/contracts.js';
import {
  createNodeCommandExecutor,
  type CommandExecutionResult
} from '../src/openhandsClient.js';

const DEFAULT_OPENHANDS_IMAGE = 'nginx:alpine';

export interface OpenHandsDockerHarness {
  ensurePrerequisites(): Promise<void>;
  runDocker(args: string[]): Promise<CommandExecutionResult>;
  createSandboxConfig(overrides?: Partial<SandboxConfig>): Promise<SandboxConfig>;
  listContainersByWorkspace(workspacePath: string): Promise<string[]>;
  containerExists(containerId: string): Promise<boolean>;
  trackSandboxId(sandboxId: string): string;
  cleanup(): Promise<void>;
}

function parseOutputLines(output: string): string[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function commandDetail(result: CommandExecutionResult): string {
  const detail = result.stderr.trim() || result.stdout.trim();
  return detail.length > 0 ? detail : `exit code ${result.exitCode}`;
}

function isTransientDockerPermissionIssue(detail: string): boolean {
  return detail.includes('operation not permitted') && detail.includes('docker.sock');
}

export function createOpenHandsDockerHarness(): OpenHandsDockerHarness {
  const executeCommand = createNodeCommandExecutor();
  const sandboxIds = new Set<string>();
  const workspacePaths = new Set<string>();

  async function runDocker(args: string[]): Promise<CommandExecutionResult> {
    let lastResult: CommandExecutionResult | undefined;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await executeCommand({
          command: 'docker',
          args
        });
        lastResult = result;
        if (isTransientDockerPermissionIssue(commandDetail(result)) && attempt < 2) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 50 * (attempt + 1));
          });
          continue;
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        if (!isTransientDockerPermissionIssue(lastError.message) || attempt >= 2) {
          throw error;
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 50 * (attempt + 1));
        });
      }
    }

    if (lastResult) {
      return lastResult;
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error('Unable to execute docker command');
  }

  async function ensurePrerequisites(): Promise<void> {
    const daemonCheck = await runDocker(['info', '--format', '{{.ServerVersion}}']);
    if (daemonCheck.exitCode !== 0) {
      throw new Error(`Docker daemon is unavailable: ${commandDetail(daemonCheck)}`);
    }

    const imageCheck = await runDocker(['image', 'inspect', DEFAULT_OPENHANDS_IMAGE, '--format', '{{.Id}}']);
    if (imageCheck.exitCode !== 0) {
      throw new Error(
        `Required local image ${DEFAULT_OPENHANDS_IMAGE} is unavailable; refusing to pull during tests`
      );
    }
  }

  async function createSandboxConfig(overrides: Partial<SandboxConfig> = {}): Promise<SandboxConfig> {
    const workspacePath =
      overrides.workspacePath ?? (await mkdtemp(join(tmpdir(), 'specmas-runtime-openhands-')));
    workspacePaths.add(workspacePath);
    const remainingOverrides = { ...overrides };
    delete remainingOverrides.workspacePath;

    return {
      image: DEFAULT_OPENHANDS_IMAGE,
      workspacePath,
      cpuLimit: 1,
      memoryMb: 128,
      networkEnabled: false,
      ...remainingOverrides
    };
  }

  async function listContainersByWorkspace(workspacePath: string): Promise<string[]> {
    const result = await runDocker(['ps', '-aq', '--filter', `volume=${workspacePath}`]);
    if (result.exitCode !== 0) {
      throw new Error(
        `Unable to list containers for workspace ${workspacePath}: ${commandDetail(result)}`
      );
    }

    return parseOutputLines(result.stdout);
  }

  async function containerExists(containerId: string): Promise<boolean> {
    const result = await runDocker(['container', 'inspect', containerId, '--format', '{{.Id}}']);
    return result.exitCode === 0;
  }

  function trackSandboxId(sandboxId: string): string {
    sandboxIds.add(sandboxId);
    return sandboxId;
  }

  async function cleanup(): Promise<void> {
    const cleanupErrors: string[] = [];

    for (const sandboxId of sandboxIds) {
      try {
        await runDocker(['rm', '-f', sandboxId]);
      } catch (error) {
        cleanupErrors.push(`sandbox ${sandboxId}: ${(error as Error).message}`);
      }
    }
    sandboxIds.clear();

    for (const workspacePath of workspacePaths) {
      try {
        const containers = await listContainersByWorkspace(workspacePath);
        for (const containerId of containers) {
          await runDocker(['rm', '-f', containerId]);
        }
      } catch (error) {
        cleanupErrors.push(`workspace ${workspacePath}: ${(error as Error).message}`);
      }

      try {
        await rm(workspacePath, { recursive: true, force: true });
      } catch (error) {
        cleanupErrors.push(`workspace dir ${workspacePath}: ${(error as Error).message}`);
      }
    }
    workspacePaths.clear();

    if (cleanupErrors.length > 0) {
      throw new Error(`OpenHands cleanup failed: ${cleanupErrors.join(' | ')}`);
    }
  }

  return {
    ensurePrerequisites,
    runDocker,
    createSandboxConfig,
    listContainersByWorkspace,
    containerExists,
    trackSandboxId,
    cleanup
  };
}
