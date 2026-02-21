import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { RuntimeStreamEvent, SandboxConfig } from '../src/contracts.js';
import { runLifecycle } from '../src/lifecycle.js';
import {
  OpenHandsRuntimeAdapter,
  createLocalDockerOpenHandsRuntimeAdapter
} from '../src/openhandsAdapter.js';
import { LocalDockerOpenHandsClient } from '../src/openhandsClient.js';
import { createOpenHandsDockerHarness } from './openhands-docker-harness.js';

const dockerHarness = createOpenHandsDockerHarness();

beforeAll(async () => {
  await dockerHarness.ensurePrerequisites();
});

afterEach(async () => {
  await dockerHarness.cleanup();
});

describe('OpenHandsRuntimeAdapter', () => {
  it('maps lifecycle operations to real OpenHands docker operations', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = new OpenHandsRuntimeAdapter(new LocalDockerOpenHandsClient());
    const captured: string[] = [];

    const lifecycle = await runLifecycle(adapter, {
      sandboxConfig,
      command: [
        'sh',
        '-lc',
        'printf "%s" "$SPECMAS_RUN_ID"; echo openhands-adapter-log > /proc/1/fd/1'
      ],
      env: {
        SPECMAS_RUN_ID: 'run-1'
      },
      capture(result, logs) {
        captured.push(result.stdout.trim(), String(logs.length));
      }
    });

    expect(lifecycle.sandboxId).toMatch(/^[a-f0-9]{12,64}$/u);
    expect(lifecycle.result.exitCode).toBe(0);
    expect(lifecycle.result.stdout.trim()).toBe('run-1');
    expect(captured).toEqual(['run-1', '1']);
    expect(lifecycle.logs).toEqual([
      {
        sequence: 1,
        stream: 'stdout',
        message: 'openhands-adapter-log'
      }
    ]);
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('still tears down sandbox when capture fails', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = new OpenHandsRuntimeAdapter(new LocalDockerOpenHandsClient());

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

  it('creates local docker adapter and runs provision/execute/stream/teardown', async () => {
    const sandboxConfig: SandboxConfig = await dockerHarness.createSandboxConfig();
    const adapter = createLocalDockerOpenHandsRuntimeAdapter();
    const logs: RuntimeStreamEvent[] = [];

    const sandbox = await adapter.provision(sandboxConfig);
    dockerHarness.trackSandboxId(sandbox.id);

    const result = await adapter.execute({
      sandbox,
      command: [
        'sh',
        '-lc',
        'printf "%s" "$SPECMAS_RUN_ID"; echo openhands-factory-log > /proc/1/fd/1'
      ],
      env: {
        SPECMAS_RUN_ID: 'run-1'
      }
    });
    await adapter.stream(sandbox.id, (event) => {
      logs.push(event);
    });
    await adapter.teardown(sandbox.id);

    expect(sandbox.id).toMatch(/^[a-f0-9]{12,64}$/u);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('run-1');
    expect(logs).toEqual([
      {
        sequence: 1,
        stream: 'stdout',
        message: 'openhands-factory-log'
      }
    ]);
    expect(await dockerHarness.containerExists(sandbox.id)).toBe(false);
  });
});
