import type { NotificationChannelAdapter } from './channels.js';
import type { NotificationChannel, NotificationEvent, NotificationRule } from './catalog.js';
import { matchesRule } from './catalog.js';

export interface DeliveryRecord {
  eventId: string;
  ruleId: string;
  channel: NotificationChannel;
  target: string;
  ok: boolean;
  message: string;
}

export interface NotificationDispatchResult {
  matchedRuleIds: string[];
  deliveries: DeliveryRecord[];
}

export class NotificationsEngine {
  private readonly adapters = new Map<NotificationChannel, NotificationChannelAdapter>();

  constructor(adapters: NotificationChannelAdapter[]) {
    adapters.forEach((adapter) => {
      this.adapters.set(adapter.channel, adapter);
    });
  }

  async dispatch(
    event: NotificationEvent,
    rules: readonly NotificationRule[]
  ): Promise<NotificationDispatchResult> {
    const matched = rules.filter((rule) => matchesRule(event, rule));
    const deliveries: DeliveryRecord[] = [];

    for (const rule of matched) {
      for (const target of rule.channels) {
        const adapter = this.adapters.get(target.channel);
        if (!adapter) {
          deliveries.push({
            eventId: event.id,
            ruleId: rule.id,
            channel: target.channel,
            target: target.target,
            ok: false,
            message: `No adapter configured for channel "${target.channel}"`
          });
          continue;
        }

        const result = await adapter.send(target.target, event);
        deliveries.push({
          eventId: event.id,
          ruleId: rule.id,
          channel: target.channel,
          target: target.target,
          ok: result.ok,
          message: result.message
        });
      }
    }

    return {
      matchedRuleIds: matched.map((rule) => rule.id).sort(),
      deliveries
    };
  }
}
