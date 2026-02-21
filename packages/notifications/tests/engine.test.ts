import { describe, expect, it } from 'vitest';
import { NotificationsEngine } from '../src/engine.js';
import { SlackChannelAdapter } from '../src/channels.js';

describe('notifications engine', () => {
  it('dispatches matched notifications through adapters', async () => {
    const engine = new NotificationsEngine([new SlackChannelAdapter()]);
    const result = await engine.dispatch(
      {
        id: 'e1',
        type: 'run.failed',
        severity: 'error',
        title: 'Run failed',
        body: 'details',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      [
        {
          id: 'rule-1',
          eventTypes: ['run.failed'],
          minimumSeverity: 'warning',
          channels: [{ channel: 'slack', target: '#alerts' }]
        }
      ]
    );

    expect(result.matchedRuleIds).toEqual(['rule-1']);
    expect(result.deliveries[0]?.ok).toBe(true);
  });

  it('returns failed delivery when adapter is missing', async () => {
    const engine = new NotificationsEngine([]);
    const result = await engine.dispatch(
      {
        id: 'e2',
        type: 'gate.failed',
        severity: 'critical',
        title: 'Gate failed',
        body: 'details',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      [
        {
          id: 'rule-2',
          eventTypes: ['*'],
          minimumSeverity: 'info',
          channels: [{ channel: 'email', target: 'alerts@example.com' }]
        }
      ]
    );

    expect(result.deliveries[0]?.ok).toBe(false);
    expect(result.deliveries[0]?.message).toContain('No adapter configured');
  });

  it('returns no matches when rules do not match event', async () => {
    const engine = new NotificationsEngine([new SlackChannelAdapter()]);
    const result = await engine.dispatch(
      {
        id: 'e3',
        type: 'run.started',
        severity: 'info',
        title: 'Run started',
        body: 'details',
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      [
        {
          id: 'rule-3',
          eventTypes: ['run.failed'],
          minimumSeverity: 'error',
          channels: [{ channel: 'slack', target: '#alerts' }]
        }
      ]
    );

    expect(result.matchedRuleIds).toEqual([]);
    expect(result.deliveries).toEqual([]);
  });
});
