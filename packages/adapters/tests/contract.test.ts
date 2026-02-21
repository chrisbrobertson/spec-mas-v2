import { describe, expect, it } from 'vitest';
import type { AgentAdapter } from '../src/contract.js';

describe('adapter contract', () => {
  it('requires createExecutionPlan', () => {
    const adapter: AgentAdapter = {
      id: 'agent-test',
      supportedRoles: ['implement', 'test', 'review'],
      requiredCredentialEnv: [],
      createExecutionPlan() {
        return { command: ['echo', 'ok'], env: {}, redactedEnvKeys: [] };
      },
      connectivityProbe() {
        return ['agent-test', '--version'];
      },
      evaluateConnectivity() {
        return { ok: true, message: 'ok', probeCommand: ['agent-test', '--version'] };
      }
    };

    expect(adapter.createExecutionPlan).toBeTypeOf('function');
    expect(adapter.connectivityProbe()).toEqual(['agent-test', '--version']);
  });
});
