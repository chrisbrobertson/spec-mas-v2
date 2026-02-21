import { describe, expect, it } from 'vitest';
import {
  EmailChannelAdapter,
  GitHubChannelAdapter,
  SlackChannelAdapter,
  WebhookChannelAdapter
} from '../src/channels.js';

const event = {
  id: 'e1',
  type: 'run.failed',
  severity: 'error' as const,
  title: 'Run failed',
  body: 'details',
  createdAt: '2026-01-01T00:00:00.000Z'
};

describe('channel adapters', () => {
  it('sends valid slack message', async () => {
    const adapter = new SlackChannelAdapter();
    const result = await adapter.send('#alerts', event);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid email target', async () => {
    const adapter = new EmailChannelAdapter();
    const result = await adapter.send('invalid-email', event);
    expect(result.ok).toBe(false);
  });

  it('rejects non-https webhook target', async () => {
    const adapter = new WebhookChannelAdapter();
    const result = await adapter.send('http://example.com', event);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid github issue target', async () => {
    const adapter = new GitHubChannelAdapter();
    const result = await adapter.send('pull:1', event);
    expect(result.ok).toBe(false);
  });
});
