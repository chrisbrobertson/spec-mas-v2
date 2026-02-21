export type AgentRole = 'implement' | 'test' | 'review';

export interface AgentCredentials {
  [envName: string]: string;
}

export interface AgentExecutionRequest {
  role: AgentRole;
  prompt: string;
  cwd: string;
  timeoutSeconds: number;
  credentials?: AgentCredentials;
  env?: Record<string, string>;
}

export interface AgentExecutionPlan {
  command: string[];
  env: Record<string, string>;
  redactedEnvKeys: string[];
}

export interface ConnectivityResult {
  ok: boolean;
  message: string;
  probeCommand: string[];
}

export interface AgentAdapter {
  readonly id: string;
  readonly supportedRoles: readonly AgentRole[];
  readonly requiredCredentialEnv: readonly string[];
  createExecutionPlan(request: AgentExecutionRequest): AgentExecutionPlan;
  connectivityProbe(): string[];
  evaluateConnectivity(exitCode: number, stderr?: string): ConnectivityResult;
}

export function assertRoleSupported(adapter: AgentAdapter, role: AgentRole): void {
  if (!adapter.supportedRoles.includes(role)) {
    throw new Error(`Role "${role}" is not supported by ${adapter.id}`);
  }
}

export function resolveCredentialEnv(
  requiredKeys: readonly string[],
  provided: AgentCredentials | undefined
): Record<string, string> {
  const credentials = provided ?? {};
  const missing = requiredKeys.filter((key) => !credentials[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required credentials: ${missing.join(', ')}`);
  }

  return Object.fromEntries(requiredKeys.map((key) => [key, credentials[key]]));
}
