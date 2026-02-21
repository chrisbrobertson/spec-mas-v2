import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { RuntimeStreamEvent } from '../src/contracts.js';
import { LocalDockerOpenHandsClient } from '../src/openhandsClient.js';
import { createOpenHandsDockerHarness } from './openhands-docker-harness.js';

const dockerHarness = createOpenHandsDockerHarness();

beforeAll(async () => {
  await dockerHarness.ensurePrerequisites();
});

afterEach(async () => {
  await dockerHarness.cleanup();
});

function parseIsoTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  expect(Number.isNaN(timestamp)).toBe(false);
  return timestamp;
}

describe('LocalDockerOpenHandsClient', () => {
  it('provisions a real docker sandbox and returns sandbox id', async () => {
    const sandboxConfig = await dockerHarness.createSandboxConfig();
    const client = new LocalDockerOpenHandsClient();

    const sandbox = await client.provision(sandboxConfig);
    dockerHarness.trackSandboxId(sandbox.sandboxId);

    expect(sandbox.sandboxId).toMatch(/^[a-f0-9]{12,64}$/u);
    expect(await dockerHarness.containerExists(sandbox.sandboxId)).toBe(true);
  });

  it('fails provisioning when docker receives an invalid image reference', async () => {
    const sandboxConfig = await dockerHarness.createSandboxConfig({
      image: 'INVALID::IMAGE'
    });
    const client = new LocalDockerOpenHandsClient();

    await expect(client.provision(sandboxConfig)).rejects.toThrow('OpenHands docker provision failed');
    expect(await dockerHarness.listContainersByWorkspace(sandboxConfig.workspacePath)).toEqual([]);
  });

  it('executes commands in sandbox with env forwarding and timestamps', async () => {
    const sandboxConfig = await dockerHarness.createSandboxConfig();
    const client = new LocalDockerOpenHandsClient();
    const sandbox = await client.provision(sandboxConfig);
    dockerHarness.trackSandboxId(sandbox.sandboxId);

    const result = await client.execute({
      sandboxId: sandbox.sandboxId,
      command: ['sh', '-lc', 'printf "%s|%s" "$OPENAI_API_KEY" "$SPECMAS_RUN_ID"'],
      env: {
        OPENAI_API_KEY: 'secret',
        SPECMAS_RUN_ID: 'run-1'
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('secret|run-1');
    expect(result.stderr).toBe('');
    const startedAt = parseIsoTimestamp(result.startedAt);
    const completedAt = parseIsoTimestamp(result.completedAt);
    expect(completedAt).toBeGreaterThanOrEqual(startedAt);
  });

  it('rejects execute requests without a command', async () => {
    const client = new LocalDockerOpenHandsClient();

    await expect(
      client.execute({
        sandboxId: 'unused-sandbox',
        command: []
      })
    ).rejects.toThrow('OpenHands command must not be empty');
  });

  it('streams real docker logs as ordered events', async () => {
    const sandboxConfig = await dockerHarness.createSandboxConfig();
    const client = new LocalDockerOpenHandsClient();
    const sandbox = await client.provision(sandboxConfig);
    dockerHarness.trackSandboxId(sandbox.sandboxId);

    await client.execute({
      sandboxId: sandbox.sandboxId,
      command: [
        'sh',
        '-lc',
        'echo openhands-stream-stdout > /proc/1/fd/1; echo openhands-stream-stderr > /proc/1/fd/2'
      ]
    });

    const events: RuntimeStreamEvent[] = [];
    await client.stream(sandbox.sandboxId, (event) => {
      events.push(event);
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(events.map((event) => event.message)).toEqual([
      'openhands-stream-stdout',
      'openhands-stream-stderr'
    ]);
  });

  it('fails stream when the sandbox id does not exist', async () => {
    const client = new LocalDockerOpenHandsClient();

    await expect(client.stream('missing-sandbox-404', () => undefined)).rejects.toThrow(
      'OpenHands docker log stream failed'
    );
  });

  it('tears down sandbox with docker rm -f', async () => {
    const sandboxConfig = await dockerHarness.createSandboxConfig();
    const client = new LocalDockerOpenHandsClient();
    const sandbox = await client.provision(sandboxConfig);
    dockerHarness.trackSandboxId(sandbox.sandboxId);

    await client.teardown(sandbox.sandboxId);

    expect(await dockerHarness.containerExists(sandbox.sandboxId)).toBe(false);
  });

  it('fails teardown when docker rm returns an error', async () => {
    const client = new LocalDockerOpenHandsClient();

    await expect(client.teardown('')).rejects.toThrow(
      'OpenHands docker teardown failed'
    );
  });
});
