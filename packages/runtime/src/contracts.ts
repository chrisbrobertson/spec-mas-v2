export interface SandboxConfig {
  image: string;
  workspacePath: string;
  cpuLimit: number;
  memoryMb: number;
  networkEnabled: boolean;
}

export interface SandboxHandle {
  id: string;
  config: SandboxConfig;
}

export interface RuntimeExecutionRequest {
  sandbox: SandboxHandle;
  command: string[];
  env?: Record<string, string>;
}

export interface RuntimeExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  startedAt: string;
  completedAt: string;
}

export interface RuntimeStreamEvent {
  sequence: number;
  stream: 'stdout' | 'stderr';
  message: string;
}

export interface RuntimeAdapter {
  provision(config: SandboxConfig): Promise<SandboxHandle>;
  execute(request: RuntimeExecutionRequest): Promise<RuntimeExecutionResult>;
  stream(sandboxId: string, onEvent: (event: RuntimeStreamEvent) => void): Promise<void>;
  teardown(sandboxId: string): Promise<void>;
}
