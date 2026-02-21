import type {
  RuntimeAdapter,
  RuntimeExecutionResult,
  RuntimeStreamEvent,
  SandboxConfig
} from './contracts.js';

export interface LifecycleRequest {
  sandboxConfig: SandboxConfig;
  command: string[];
  env?: Record<string, string>;
  capture?: (result: RuntimeExecutionResult, logs: RuntimeStreamEvent[]) => void | Promise<void>;
}

export interface LifecycleResult {
  sandboxId: string;
  result: RuntimeExecutionResult;
  logs: RuntimeStreamEvent[];
}

export async function runLifecycle(adapter: RuntimeAdapter, request: LifecycleRequest): Promise<LifecycleResult> {
  const sandbox = await adapter.provision(request.sandboxConfig);
  const logs: RuntimeStreamEvent[] = [];

  try {
    const result = await adapter.execute({
      sandbox,
      command: request.command,
      env: request.env
    });

    await adapter.stream(sandbox.id, (event) => {
      logs.push(event);
    });

    if (request.capture) {
      await request.capture(result, logs);
    }

    return {
      sandboxId: sandbox.id,
      result,
      logs
    };
  } finally {
    await adapter.teardown(sandbox.id);
  }
}
