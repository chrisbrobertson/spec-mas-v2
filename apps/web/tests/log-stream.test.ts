import { describe, expect, it } from 'vitest';
import { LiveLogStreamModel } from '../src/logStream.js';

describe('log-stream', () => {
  it('orders out-of-order logs and keeps reconnect timeline', () => {
    const model = new LiveLogStreamModel();
    model.connect('2026-02-19T10:00:00.000Z');

    model.receive({
      runId: 'run-1',
      sequence: 2,
      timestamp: '2026-02-19T10:00:02.000Z',
      message: 'second',
      level: 'info'
    });
    model.receive({
      runId: 'run-1',
      sequence: 1,
      timestamp: '2026-02-19T10:00:01.000Z',
      message: 'first',
      level: 'info'
    });

    model.disconnect('2026-02-19T10:00:03.000Z', 'network issue');
    model.reconnect('2026-02-19T10:00:04.000Z');

    model.receive({
      runId: 'run-1',
      sequence: 3,
      timestamp: '2026-02-19T10:00:05.000Z',
      message: 'third',
      level: 'warn'
    });

    const state = model.snapshot();
    expect(state.logs.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(state.reconnectCount).toBe(1);
    expect(state.timeline.map((entry) => entry.type)).toEqual([
      'reconnect',
      'log',
      'log',
      'disconnect',
      'reconnect',
      'log'
    ]);
  });

  it('rejects log ingestion while disconnected and drops duplicates', () => {
    const model = new LiveLogStreamModel();
    const beforeConnect = model.receive({
      runId: 'run-1',
      sequence: 1,
      timestamp: '2026-02-19T10:00:01.000Z',
      message: 'first',
      level: 'info'
    });
    expect(beforeConnect).toBe(false);

    model.connect('2026-02-19T10:00:02.000Z');
    const firstAccepted = model.receive({
      runId: 'run-1',
      sequence: 1,
      timestamp: '2026-02-19T10:00:03.000Z',
      message: 'first',
      level: 'info'
    });
    const duplicate = model.receive({
      runId: 'run-1',
      sequence: 1,
      timestamp: '2026-02-19T10:00:04.000Z',
      message: 'duplicate',
      level: 'warn'
    });

    expect(firstAccepted).toBe(true);
    expect(duplicate).toBe(false);
    expect(model.snapshot().logs).toHaveLength(1);
  });

  it('throws for invalid non-positive sequence values', () => {
    const model = new LiveLogStreamModel();
    model.connect('2026-02-19T10:00:00.000Z');

    expect(() =>
      model.receive({
        runId: 'run-1',
        sequence: 0,
        timestamp: '2026-02-19T10:00:01.000Z',
        message: 'invalid',
        level: 'error'
      })
    ).toThrow('Invalid log sequence: 0');
  });
});
