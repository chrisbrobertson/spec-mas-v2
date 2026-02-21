import type { NotificationChannel, NotificationEvent } from './catalog.js';

export interface ChannelSendResult {
  ok: boolean;
  message: string;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(target: string, event: NotificationEvent): Promise<ChannelSendResult>;
}

function renderDefaultMessage(event: NotificationEvent): string {
  return `[${event.severity}] ${event.title} (${event.type})`;
}

export class SlackChannelAdapter implements NotificationChannelAdapter {
  readonly channel = 'slack' as const;

  async send(target: string, event: NotificationEvent): Promise<ChannelSendResult> {
    if (!target.startsWith('#')) {
      return { ok: false, message: 'Slack target must be a channel starting with #' };
    }
    return { ok: true, message: `slack:${target}:${renderDefaultMessage(event)}` };
  }
}

export class EmailChannelAdapter implements NotificationChannelAdapter {
  readonly channel = 'email' as const;

  async send(target: string, event: NotificationEvent): Promise<ChannelSendResult> {
    if (!target.includes('@')) {
      return { ok: false, message: 'Email target must include @' };
    }
    return { ok: true, message: `email:${target}:${renderDefaultMessage(event)}` };
  }
}

export class WebhookChannelAdapter implements NotificationChannelAdapter {
  readonly channel = 'webhook' as const;

  async send(target: string, event: NotificationEvent): Promise<ChannelSendResult> {
    if (!target.startsWith('https://')) {
      return { ok: false, message: 'Webhook target must be https URL' };
    }
    return { ok: true, message: `webhook:${target}:${event.id}` };
  }
}

export class GitHubChannelAdapter implements NotificationChannelAdapter {
  readonly channel = 'github' as const;

  async send(target: string, event: NotificationEvent): Promise<ChannelSendResult> {
    if (!target.startsWith('issue:')) {
      return { ok: false, message: 'GitHub target must be issue:<number>' };
    }
    return { ok: true, message: `github:${target}:${renderDefaultMessage(event)}` };
  }
}
