import type {
  RuntimeAdapter,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
  RuntimeStreamEvent,
  SandboxConfig,
  SandboxHandle
} from './contracts.js';
import {
  LocalDockerOpenHandsClient,
  type LocalDockerOpenHandsClientOptions,
  type OpenHandsClient
} from './openhandsClient.js';

export class OpenHandsRuntimeAdapter implements RuntimeAdapter {
  constructor(private readonly client: OpenHandsClient) {}

  async provision(config: SandboxConfig): Promise<SandboxHandle> {
    const sandbox = await this.client.provision(config);
    return {
      id: sandbox.sandboxId,
      config
    };
  }

  async execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult> {
    return this.client.execute({
      sandboxId: request.sandbox.id,
      command: request.command,
      env: request.env
    });
  }

  async stream(sandboxId: string, onEvent: (event: RuntimeStreamEvent) => void): Promise<void> {
    await this.client.stream(sandboxId, onEvent);
  }

  async teardown(sandboxId: string): Promise<void> {
    await this.client.teardown(sandboxId);
  }
}

export function createLocalDockerOpenHandsRuntimeAdapter(
  options: LocalDockerOpenHandsClientOptions = {}
): OpenHandsRuntimeAdapter {
  return new OpenHandsRuntimeAdapter(new LocalDockerOpenHandsClient(options));
}
