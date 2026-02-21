import { spawn } from 'node:child_process';

type ServiceExecutionMode = 'local_process' | 'containerized_dependency';

interface RuntimeBootstrapProfile {
  appServices: Partial<Record<'api' | 'web' | 'orchestrator_worker', ServiceExecutionMode>>;
  dependencies: Partial<Record<'openhands' | 'postgres' | 'mailhog' | 'sqlite_web', ServiceExecutionMode>>;
}

interface RuntimeBootstrapInput {
  profile: RuntimeBootstrapProfile;
  dockerAvailable: boolean;
  openhandsEnabled: boolean;
  enabledDependencies?: Array<'postgres' | 'mailhog' | 'sqlite_web'>;
}

type AssertRuntimeBootstrap = (input: RuntimeBootstrapInput) => { dockerRequired: boolean };

export interface RuntimeReadinessCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface RuntimeReadinessResult {
  ready: boolean;
  dockerRequired: boolean;
  openhandsEnabled: boolean;
  checks: RuntimeReadinessCheck[];
}

const RUNTIME_BOOTSTRAP_MODULES = [
  '../../../packages/runtime/dist/bootstrap.js',
  '../../../packages/runtime/src/bootstrap.js'
] as const;

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.once('error', reject);
    child.once('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseDependencies(value: string | undefined): Array<'postgres' | 'mailhog' | 'sqlite_web'> {
  if (!value) {
    return [];
  }

  const allowed = new Set(['postgres', 'mailhog', 'sqlite_web']);
  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry): entry is 'postgres' | 'mailhog' | 'sqlite_web' => allowed.has(entry));

  return [...new Set(parsed)];
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
  throw new Error(lastError instanceof Error ? lastError.message : 'unable to load runtime bootstrap module');
}

async function loadRuntimeBootstrapAsserter(): Promise<AssertRuntimeBootstrap> {
  const loaded = await importWithFallback<Record<string, unknown>>(RUNTIME_BOOTSTRAP_MODULES);
  const candidate = loaded.assertRuntimeBootstrap;
  if (typeof candidate !== 'function') {
    throw new Error('assertRuntimeBootstrap export is unavailable');
  }
  return candidate as AssertRuntimeBootstrap;
}

function failure(name: string, message: string): RuntimeReadinessCheck {
  return { name, ok: false, message };
}

function success(name: string, message: string): RuntimeReadinessCheck {
  return { name, ok: true, message };
}

export async function evaluateRuntimeReadiness(env: NodeJS.ProcessEnv = process.env): Promise<RuntimeReadinessResult> {
  const checks: RuntimeReadinessCheck[] = [];
  const openhandsEnabled = parseBoolean(env.OPENHANDS_ENABLED, true);
  const dependencies = parseDependencies(env.RUNTIME_DEPENDENCIES);
  const dockerRequired = openhandsEnabled || dependencies.length > 0;

  let dockerAvailable = false;
  if (dockerRequired) {
    const dockerInfo = await runCommand('docker', ['info', '--format', '{{.ServerVersion}}']);
    dockerAvailable = dockerInfo.exitCode === 0;
    checks.push(
      dockerAvailable
        ? success('docker', `docker daemon reachable (${dockerInfo.stdout.trim() || 'version unknown'})`)
        : failure('docker', dockerInfo.stderr.trim() || dockerInfo.stdout.trim() || 'docker daemon unavailable')
    );
  } else {
    checks.push(success('docker', 'docker not required for current runtime profile'));
  }

  try {
    const assertRuntimeBootstrap = await loadRuntimeBootstrapAsserter();
    assertRuntimeBootstrap({
      profile: {
        appServices: {
          api: 'local_process',
          web: 'local_process',
          orchestrator_worker: 'local_process'
        },
        dependencies: {
          openhands: 'containerized_dependency',
          postgres: 'containerized_dependency',
          mailhog: 'containerized_dependency',
          sqlite_web: 'containerized_dependency'
        }
      },
      dockerAvailable,
      openhandsEnabled,
      enabledDependencies: dependencies
    });
    checks.push(success('runtime-bootstrap', 'runtime profile is valid for v2 local-process mode'));
  } catch (error) {
    checks.push(
      failure(
        'runtime-bootstrap',
        error instanceof Error ? error.message : 'runtime bootstrap validation failed'
      )
    );
  }

  if (dockerRequired && dockerAvailable && openhandsEnabled) {
    const openhandsImage = env.OPENHANDS_IMAGE ?? 'nginx:alpine';
    const imageInspect = await runCommand('docker', ['image', 'inspect', openhandsImage, '--format', '{{.Id}}']);
    checks.push(
      imageInspect.exitCode === 0
        ? success('openhands-image', `runtime image available (${openhandsImage})`)
        : failure(
            'openhands-image',
            imageInspect.stderr.trim() || imageInspect.stdout.trim() || `runtime image unavailable (${openhandsImage})`
          )
    );
  }

  return {
    ready: checks.every((check) => check.ok),
    dockerRequired,
    openhandsEnabled,
    checks
  };
}
