import {
  assertRoleSupported,
  resolveCredentialEnv,
  type AgentAdapter,
  type AgentExecutionPlan,
  type AgentExecutionRequest,
  type ConnectivityResult
} from './contract.js';

export class GeminiAdapter implements AgentAdapter {
  readonly id = 'agent-gemini-cli';
  readonly supportedRoles = ['implement', 'test', 'review'] as const;
  readonly requiredCredentialEnv = ['GEMINI_API_KEY'] as const;

  createExecutionPlan(request: AgentExecutionRequest): AgentExecutionPlan {
    assertRoleSupported(this, request.role);
    const credentialEnv = resolveCredentialEnv(this.requiredCredentialEnv, request.credentials);

    return {
      command: [
        'gemini',
        '--prompt',
        request.prompt,
        '--output-format',
        'text',
        '--approval-mode',
        'yolo',
        '--include-directories',
        request.cwd
      ],
      env: {
        ...request.env,
        ...credentialEnv,
        SPECMAS_AGENT_ID: this.id,
        SPECMAS_AGENT_ROLE: request.role,
        SPECMAS_TIMEOUT_SECONDS: String(request.timeoutSeconds)
      },
      redactedEnvKeys: [...this.requiredCredentialEnv]
    };
  }

  connectivityProbe(): string[] {
    return ['gemini', '--version'];
  }

  evaluateConnectivity(exitCode: number, stderr?: string): ConnectivityResult {
    if (exitCode === 0) {
      return {
        ok: true,
        message: 'Gemini CLI is reachable',
        probeCommand: this.connectivityProbe()
      };
    }

    return {
      ok: false,
      message: `Gemini CLI probe failed${stderr ? `: ${stderr}` : ''}`,
      probeCommand: this.connectivityProbe()
    };
  }
}
