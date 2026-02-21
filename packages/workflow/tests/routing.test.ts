import { describe, expect, it } from 'vitest';
import { selectAdapter } from '../src/routing.js';

describe('routing engine', () => {
  it('selects first healthy adapter and fallback chain', () => {
    const decision = selectAdapter(
      { role: 'implement', preferredOrder: ['agent-codex', 'agent-claude'] },
      [
        { adapterId: 'agent-claude', supportsRoles: ['implement'], healthy: true, priority: 1 },
        { adapterId: 'agent-codex', supportsRoles: ['implement'], healthy: true, priority: 5 }
      ]
    );

    expect(decision.selectedAdapterId).toBe('agent-codex');
    expect(decision.fallbackChain).toEqual(['agent-claude']);
  });

  it('returns no selection when no adapter supports role', () => {
    const decision = selectAdapter(
      { role: 'review' },
      [{ adapterId: 'agent-codex', supportsRoles: ['implement'], healthy: true, priority: 1 }]
    );

    expect(decision.selectedAdapterId).toBeNull();
    expect(decision.explanation).toContain('No adapters support role');
  });

  it('breaks ties deterministically by adapter id', () => {
    const decision = selectAdapter(
      { role: 'test' },
      [
        { adapterId: 'zeta', supportsRoles: ['test'], healthy: true, priority: 1 },
        { adapterId: 'alpha', supportsRoles: ['test'], healthy: true, priority: 1 }
      ]
    );

    expect(decision.selectedAdapterId).toBe('alpha');
    expect(decision.fallbackChain).toEqual(['zeta']);
  });
});
