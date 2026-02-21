import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { runLifecycle } from '../src/lifecycle.js';
import type { SandboxConfig } from '../src/contracts.js';
import { createLocalDockerOpenHandsRuntimeAdapter } from '../src/openhandsAdapter.js';
import { createOpenHandsDockerHarness } from './openhands-docker-harness.js';

const dockerHarness = createOpenHandsDockerHarness();

beforeAll(async () => {
  await dockerHarness.ensurePrerequisites();
});

afterEach(async () => {
  await dockerHarness.cleanup();
});

describe('OpenHands orchestration via runLifecycle', () => {
  it('runs OpenHands provision execute stream capture teardown with real docker', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();
    const captured: string[] = [];

    const result = await runLifecycle(adapter, {
      sandboxConfig,
      command: [
        'sh',
        '-lc',
        'printf "%s" "$OPENHANDS_RUN_ID"; echo lifecycle-log-stdout > /proc/1/fd/1; echo lifecycle-log-stderr > /proc/1/fd/2'
      ],
      env: {
        OPENHANDS_RUN_ID: 'run-1'
      },
      capture(result, logs) {
        captured.push(result.stdout.trim(), String(logs.length));
      }
    });

    expect(result.sandboxId).toMatch(/^[a-f0-9]{12,64}$/u);
    expect(result.result.exitCode).toBe(0);
    expect(result.result.stdout.trim()).toBe('run-1');
    expect(result.logs).toHaveLength(2);
    expect(result.logs.map((event) => event.message)).toEqual([
      'lifecycle-log-stdout',
      'lifecycle-log-stderr'
    ]);
    expect(captured).toEqual(['run-1', '2']);
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('guarantees OpenHands teardown when execute fails', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();

    await expect(
      runLifecycle(adapter, {
        sandboxConfig,
        command: []
      })
    ).rejects.toThrow('OpenHands command must not be empty');
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('guarantees OpenHands teardown and propagates capture failures', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();

    await expect(
      runLifecycle(adapter, {
        sandboxConfig,
        command: ['sh', '-lc', 'echo ready'],
        capture() {
          throw new Error('capture failed');
        }
      })
    ).rejects.toThrow('capture failed');

    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('short-circuits OpenHands orchestration on provision failure', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig({
      image: 'INVALID::IMAGE'
    });
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();

    await expect(
      runLifecycle(adapter, {
        sandboxConfig,
        command: ['sh', '-lc', 'echo should-not-run']
      })
    ).rejects.toThrow('OpenHands docker provision failed');
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('keeps lifecycle successful when sandbox is removed during capture cleanup', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();

    const lifecycle = await runLifecycle(adapter, {
      sandboxConfig,
      command: ['sh', '-lc', 'cat /etc/hostname'],
      async capture() {
        const containers = await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath);
        const sandboxId = containers[0];
        if (!sandboxId) {
          throw new Error('Missing sandbox container during capture');
        }

        const removal = await dockerHarness.runDocker(['rm', '-f', sandboxId]);
        if (removal.exitCode !== 0) {
          throw new Error(`Unable to remove sandbox before teardown: ${removal.stderr.trim()}`);
        }
      }
    });

    expect(lifecycle.result.exitCode).toBe(0);
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });
});
