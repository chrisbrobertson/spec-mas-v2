import { describe, expect, it } from 'vitest';
import { canTransition, transitionIssueState } from '../src/issueState.js';

describe('issue state automation', () => {
  it('supports legal state transition with structured comment', () => {
    const result = transitionIssueState({
      from: 'todo',
      to: 'started',
      actor: 'agent-codex',
      summary: 'Implementation started'
    });

    expect(result.ok).toBe(true);
    expect(result.comment).toContain('### STARTED');
  });

  it('rejects illegal state transitions', () => {
    expect(() =>
      transitionIssueState({
        from: 'todo',
        to: 'passed',
        actor: 'agent-codex',
        summary: 'Skipping'
      })
    ).toThrow('Illegal issue transition');
  });

  it('exposes deterministic transition graph checks', () => {
    expect(canTransition('failed', 'started')).toBe(true);
    expect(canTransition('passed', 'started')).toBe(false);
  });
});
