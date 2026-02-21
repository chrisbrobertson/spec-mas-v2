import { describe, expect, it } from 'vitest';
import { CodexAdapter } from '../src/codex.js';

describe('codex adapter', () => {
  it('builds codex execution command', () => {
    const adapter = new CodexAdapter();
    const plan = adapter.createExecutionPlan({
      role: 'test',
      prompt: 'Generate tests',
      cwd: '/repo',
      timeoutSeconds: 600,
      credentials: {
        OPENAI_API_KEY: 'secret'
      }
    });

    expect(plan.command).toEqual([
      'codex',
      'exec',
      '--cd',
      '/repo',
      '--skip-git-repo-check',
      '--config',
      'model_reasoning_effort="medium"',
      'Generate tests'
    ]);
    expect(plan.env.SPECMAS_AGENT_ROLE).toBe('test');
    expect(plan.redactedEnvKeys).toEqual(['OPENAI_API_KEY']);
  });

  it('rejects missing credentials', () => {
    const adapter = new CodexAdapter();
    expect(() =>
      adapter.createExecutionPlan({
        role: 'test',
        prompt: 'Generate tests',
        cwd: '/repo',
        timeoutSeconds: 600
      })
    ).toThrow('Missing required credentials: OPENAI_API_KEY');
  });

  it('returns connectivity success for exit code zero', () => {
    const adapter = new CodexAdapter();
    expect(adapter.evaluateConnectivity(0).ok).toBe(true);
    expect(adapter.connectivityProbe()).toEqual(['codex', '--version']);
  });

  it('returns connectivity failure details when probe exits non-zero', () => {
    const adapter = new CodexAdapter();
    const result = adapter.evaluateConnectivity(2, 'binary missing');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('binary missing');
    expect(result.probeCommand).toEqual(['codex', '--version']);
  });
});
