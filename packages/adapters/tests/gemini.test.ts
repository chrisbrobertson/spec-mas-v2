import { describe, expect, it } from 'vitest';
import { GeminiAdapter } from '../src/gemini.js';

describe('gemini adapter', () => {
  it('builds noninteractive gemini execution command', () => {
    const adapter = new GeminiAdapter();
    const plan = adapter.createExecutionPlan({
      role: 'review',
      prompt: 'Review code',
      cwd: '/repo',
      timeoutSeconds: 120,
      credentials: {
        GEMINI_API_KEY: 'secret'
      },
      env: {
        SPECMAS_RUN_ID: 'run-123'
      }
    });

    expect(plan.command).toEqual([
      'gemini',
      '--prompt',
      'Review code',
      '--output-format',
      'text',
      '--approval-mode',
      'yolo',
      '--include-directories',
      '/repo'
    ]);
    expect(plan.env).toMatchObject({
      GEMINI_API_KEY: 'secret',
      SPECMAS_AGENT_ID: 'agent-gemini-cli',
      SPECMAS_AGENT_ROLE: 'review',
      SPECMAS_TIMEOUT_SECONDS: '120',
      SPECMAS_RUN_ID: 'run-123'
    });
    expect(plan.redactedEnvKeys).toEqual(['GEMINI_API_KEY']);
  });

  it('fails on missing required credential', () => {
    const adapter = new GeminiAdapter();

    expect(() =>
      adapter.createExecutionPlan({
        role: 'review',
        prompt: 'Review code',
        cwd: '/repo',
        timeoutSeconds: 120
      })
    ).toThrow('Missing required credentials: GEMINI_API_KEY');
  });

  it('returns connectivity success for exit code zero', () => {
    const adapter = new GeminiAdapter();
    expect(adapter.evaluateConnectivity(0).ok).toBe(true);
    expect(adapter.connectivityProbe()).toEqual(['gemini', '--version']);
  });

  it('includes probe command in connectivity failure report', () => {
    const adapter = new GeminiAdapter();
    const result = adapter.evaluateConnectivity(1);
    expect(result.ok).toBe(false);
    expect(result.probeCommand).toEqual(['gemini', '--version']);
  });

  it('includes stderr details in connectivity failure report', () => {
    const adapter = new GeminiAdapter();
    const result = adapter.evaluateConnectivity(1, 'permission denied');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('permission denied');
  });
});
