import { describe, expect, it } from 'vitest';
import { InMemoryEventBus } from '../src/eventBus.js';

interface Events {
  [eventName: string]: unknown;
  'run.started': { id: string };
  'run.completed': { id: string; status: 'ok' | 'error' };
}

describe('event bus', () => {
  it('publishes events in subscription order', () => {
    const bus = new InMemoryEventBus<Events>();
    const order: string[] = [];

    bus.subscribe('run.started', () => order.push('first'));
    bus.subscribe('run.started', () => order.push('second'));

    bus.publish('run.started', { id: 'r1' });

    expect(order).toEqual(['first', 'second']);
  });

  it('supports unsubscribe and listener counts', () => {
    const bus = new InMemoryEventBus<Events>();
    const seen: string[] = [];

    const stop = bus.subscribe('run.started', ({ id }) => seen.push(id));
    expect(bus.listenerCount('run.started')).toBe(1);

    bus.publish('run.started', { id: 'r1' });
    stop();
    bus.publish('run.started', { id: 'r2' });

    expect(seen).toEqual(['r1']);
    expect(bus.listenerCount('run.started')).toBe(0);
  });

  it('is a no-op for events with no listeners', () => {
    const bus = new InMemoryEventBus<Events>();
    expect(() => bus.publish('run.started', { id: 'r0' })).not.toThrow();
    expect(bus.listenerCount('run.started')).toBe(0);
  });

  it('keeps publish deterministic when handlers unsubscribe mid-flight', () => {
    const bus = new InMemoryEventBus<Events>();
    const seen: string[] = [];

    const stopFirst = bus.subscribe('run.completed', ({ id }) => {
      seen.push(`first:${id}`);
      stopFirst();
    });
    bus.subscribe('run.completed', ({ id }) => {
      seen.push(`second:${id}`);
    });

    bus.publish('run.completed', { id: 'r1', status: 'ok' });
    bus.publish('run.completed', { id: 'r2', status: 'ok' });

    expect(seen).toEqual(['first:r1', 'second:r1', 'second:r2']);
  });
});
