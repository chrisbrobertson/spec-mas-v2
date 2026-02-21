export type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface NotificationEvent {
  id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  runId?: string;
  taskId?: string;
  createdAt: string;
}

export interface NotificationRule {
  id: string;
  eventTypes: string[];
  minimumSeverity: NotificationSeverity;
  channels: ChannelTarget[];
}

export type NotificationChannel = 'slack' | 'email' | 'webhook' | 'github';

export interface ChannelTarget {
  channel: NotificationChannel;
  target: string;
}

const severityRank: Record<NotificationSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
  critical: 4
};

export function matchesRule(event: NotificationEvent, rule: NotificationRule): boolean {
  const typeMatch = rule.eventTypes.includes(event.type) || rule.eventTypes.includes('*');
  const severityMatch = severityRank[event.severity] >= severityRank[rule.minimumSeverity];
  return typeMatch && severityMatch;
}
