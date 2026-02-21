export interface LogEntry {
  runId: string;
  sequence: number;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface TimelineEntry {
  order: number;
  type: 'log' | 'disconnect' | 'reconnect';
  sequence?: number;
  timestamp: string;
  message: string;
}

export interface LogStreamState {
  connected: boolean;
  reconnectCount: number;
  lastSequence: number;
  logs: LogEntry[];
  timeline: TimelineEntry[];
}

function sortBySequence(left: LogEntry, right: LogEntry): number {
  if (left.sequence !== right.sequence) {
    return left.sequence - right.sequence;
  }

  return left.timestamp.localeCompare(right.timestamp);
}

export class LiveLogStreamModel {
  private connected = false;
  private reconnectCount = 0;
  private lastSequence = 0;
  private timelineOrder = 0;
  private readonly logsBySequence = new Map<number, LogEntry>();
  private readonly timeline: TimelineEntry[] = [];

  connect(timestamp: string): void {
    if (this.connected) {
      return;
    }

    this.connected = true;
    this.addTimeline('reconnect', timestamp, 'stream connected');
  }

  disconnect(timestamp: string, reason = 'stream disconnected'): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.addTimeline('disconnect', timestamp, reason);
  }

  reconnect(timestamp: string): void {
    if (this.connected) {
      return;
    }

    this.reconnectCount += 1;
    this.connected = true;
    this.addTimeline('reconnect', timestamp, `stream reconnected #${this.reconnectCount}`);
  }

  receive(entry: LogEntry): boolean {
    if (!this.connected) {
      return false;
    }

    if (entry.sequence <= 0) {
      throw new Error(`Invalid log sequence: ${entry.sequence}`);
    }

    if (this.logsBySequence.has(entry.sequence)) {
      return false;
    }

    this.logsBySequence.set(entry.sequence, entry);
    if (entry.sequence > this.lastSequence) {
      this.lastSequence = entry.sequence;
    }

    this.addTimeline('log', entry.timestamp, entry.message, entry.sequence);
    return true;
  }

  snapshot(): LogStreamState {
    const logs = Array.from(this.logsBySequence.values()).sort(sortBySequence);
    return {
      connected: this.connected,
      reconnectCount: this.reconnectCount,
      lastSequence: this.lastSequence,
      logs,
      timeline: [...this.timeline].sort((left, right) => left.order - right.order)
    };
  }

  private addTimeline(
    type: TimelineEntry['type'],
    timestamp: string,
    message: string,
    sequence?: number
  ): void {
    this.timelineOrder += 1;
    this.timeline.push({
      order: this.timelineOrder,
      type,
      sequence,
      timestamp,
      message
    });
  }
}
