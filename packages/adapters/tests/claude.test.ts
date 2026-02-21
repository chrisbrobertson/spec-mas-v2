import { describe, expect, it } from 'vitest';
import { ClaudeAdapter } from '../src/claude.js';

describe('claude adapter', () => {
  it('builds noninteractive claude execution command', () => {
    const adapter = new ClaudeAdapter();
    const plan = adapter.createExecutionPlan({
      role: 'implement',
      prompt: 'Implement feature',
      cwd: '/repo',
      timeoutSeconds: 300,
      credentials: {
        ANTHROPIC_API_KEY: 'secret'
      },
      env: {
        SPECMAS_RUN_ID: 'run-123'
      }
    });

    expect(plan.command).toEqual([
      'claude',
      '--print',
      '--output-format',
      'text',
      '--permission-mode',
      'bypassPermissions',
      '--add-dir',
      '/repo',
      'Implement feature'
    ]);
    expect(plan.env).toMatchObject({
      ANTHROPIC_API_KEY: 'secret',
      SPECMAS_AGENT_ID: 'agent-claude-code',
      SPECMAS_AGENT_ROLE: 'implement',
      SPECMAS_TIMEOUT_SECONDS: '300',
      SPECMAS_RUN_ID: 'run-123'
    });
    expect(plan.redactedEnvKeys).toEqual(['ANTHROPIC_API_KEY']);
  });

  it('fails when required credentials are missing', () => {
    const adapter = new ClaudeAdapter();

    expect(() =>
      adapter.createExecutionPlan({
        role: 'implement',
        prompt: 'Implement feature',
        cwd: '/repo',
        timeoutSeconds: 300
      })
    ).toThrow('Missing required credentials: ANTHROPIC_API_KEY');
  });

  it('returns connectivity success for exit code zero', () => {
    const adapter = new ClaudeAdapter();
    const result = adapter.evaluateConnectivity(0);
    expect(result.ok).toBe(true);
    expect(result.probeCommand).toEqual(['claude', '--version']);
  });

  it('evaluates connectivity probe failures', () => {
    const adapter = new ClaudeAdapter();
    const result = adapter.evaluateConnectivity(1, 'not found');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not found');
    expect(result.probeCommand).toEqual(['claude', '--version']);
  });

  it('handles connectivity failures without stderr details', () => {
    const adapter = new ClaudeAdapter();
    const result = adapter.evaluateConnectivity(1);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Claude CLI probe failed');
  });
});
