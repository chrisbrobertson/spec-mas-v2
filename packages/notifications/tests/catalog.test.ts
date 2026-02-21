import { describe, expect, it } from 'vitest';
import { matchesRule } from '../src/catalog.js';

describe('notification catalog rule matching', () => {
  it('matches event by type and minimum severity', () => {
    const event = {
      id: 'e1',
      type: 'run.failed',
      severity: 'error' as const,
      title: 'Run failed',
      body: 'details',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const rule = {
      id: 'r1',
      eventTypes: ['run.failed'],
      minimumSeverity: 'warning' as const,
      channels: [{ channel: 'slack' as const, target: '#alerts' }]
    };

    expect(matchesRule(event, rule)).toBe(true);
  });

  it('rejects event below severity threshold', () => {
    const event = {
      id: 'e1',
      type: 'run.started',
      severity: 'info' as const,
      title: 'Run started',
      body: 'details',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const rule = {
      id: 'r1',
      eventTypes: ['run.started'],
      minimumSeverity: 'error' as const,
      channels: [{ channel: 'slack' as const, target: '#alerts' }]
    };

    expect(matchesRule(event, rule)).toBe(false);
  });

  it('supports wildcard event type matching', () => {
    const event = {
      id: 'e1',
      type: 'gate.failed',
      severity: 'critical' as const,
      title: 'Gate failed',
      body: 'details',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    const rule = {
      id: 'r1',
      eventTypes: ['*'],
      minimumSeverity: 'info' as const,
      channels: [{ channel: 'slack' as const, target: '#alerts' }]
    };

    expect(matchesRule(event, rule)).toBe(true);
  });
});
