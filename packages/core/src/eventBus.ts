export interface EventMap {
  [eventName: string]: unknown;
}

export type EventHandler<TPayload> = (payload: Readonly<TPayload>) => void;
export type Unsubscribe = () => void;

export interface EventBus<TEvents extends EventMap> {
  subscribe<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe;
  publish<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
  listenerCount<K extends keyof TEvents>(event: K): number;
}

export class InMemoryEventBus<TEvents extends EventMap> implements EventBus<TEvents> {
  private readonly handlers: {
    [K in keyof TEvents]?: Array<EventHandler<TEvents[K]>>;
  } = {};

  subscribe<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): Unsubscribe {
    const list = this.handlers[event] ?? [];
    list.push(handler);
    this.handlers[event] = list;

    return () => {
      const current = this.handlers[event] ?? [];
      const index = current.indexOf(handler);
      if (index < 0) {
        return;
      }
      const updated = [...current];
      updated.splice(index, 1);
      this.handlers[event] = updated;
    };
  }

  publish<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    const list = [...(this.handlers[event] ?? [])];
    for (const handler of list) {
      handler(payload);
    }
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    return (this.handlers[event] ?? []).length;
  }
}
