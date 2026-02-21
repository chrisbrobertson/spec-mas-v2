import {
  assertRoleSupported,
  resolveCredentialEnv,
  type AgentAdapter,
  type AgentExecutionPlan,
  type AgentExecutionRequest,
  type ConnectivityResult
} from './contract.js';

export class CodexAdapter implements AgentAdapter {
  readonly id = 'agent-codex';
  readonly supportedRoles = ['implement', 'test', 'review'] as const;
  readonly requiredCredentialEnv = ['OPENAI_API_KEY'] as const;

  createExecutionPlan(request: AgentExecutionRequest): AgentExecutionPlan {
    assertRoleSupported(this, request.role);
    const credentialEnv = resolveCredentialEnv(this.requiredCredentialEnv, request.credentials);

    return {
      command: [
        'codex',
        'exec',
        '--cd',
        request.cwd,
        '--skip-git-repo-check',
        '--config',
        `model_reasoning_effort=\"medium\"`,
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
    return ['codex', '--version'];
  }

  evaluateConnectivity(exitCode: number, stderr?: string): ConnectivityResult {
    if (exitCode === 0) {
      return {
        ok: true,
        message: 'Codex CLI is reachable',
        probeCommand: this.connectivityProbe()
      };
    }

    return {
      ok: false,
      message: `Codex CLI probe failed${stderr ? `: ${stderr}` : ''}`,
      probeCommand: this.connectivityProbe()
    };
  }
}
