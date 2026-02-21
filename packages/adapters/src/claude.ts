import {
  assertRoleSupported,
  resolveCredentialEnv,
  type AgentAdapter,
  type AgentExecutionPlan,
  type AgentExecutionRequest,
  type ConnectivityResult
} from './contract.js';

export class ClaudeAdapter implements AgentAdapter {
  readonly id = 'agent-claude-code';
  readonly supportedRoles = ['implement', 'test', 'review'] as const;
  readonly requiredCredentialEnv = ['ANTHROPIC_API_KEY'] as const;

  createExecutionPlan(request: AgentExecutionRequest): AgentExecutionPlan {
    assertRoleSupported(this, request.role);
    const credentialEnv = resolveCredentialEnv(this.requiredCredentialEnv, request.credentials);

    return {
      command: [
        'claude',
        '--print',
        '--output-format',
        'text',
        '--permission-mode',
        'bypassPermissions',
        '--add-dir',
        request.cwd,
        request.prompt
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
    return ['claude', '--version'];
  }

  evaluateConnectivity(exitCode: number, stderr?: string): ConnectivityResult {
    if (exitCode === 0) {
      return {
        ok: true,
        message: 'Claude CLI is reachable',
        probeCommand: this.connectivityProbe()
      };
    }

    return {
      ok: false,
      message: `Claude CLI probe failed${stderr ? `: ${stderr}` : ''}`,
      probeCommand: this.connectivityProbe()
    };
  }
}
