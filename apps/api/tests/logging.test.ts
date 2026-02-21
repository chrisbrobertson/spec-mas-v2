import { describe, expect, it } from 'vitest';
import {
  createDeterministicCorrelationIdGenerator,
  type StructuredLogEntry,
  type StructuredLogger
} from '../src/logging.js';
import { createServer } from '../src/server.js';

function createMemoryLogger(entries: StructuredLogEntry[]): StructuredLogger {
  return {
    info(entry: StructuredLogEntry) {
      entries.push(entry);
    }
  };
}

describe('logging', () => {
  it('emits structured request logs with deterministic correlation ids', async () => {
    const entries: StructuredLogEntry[] = [];
    const app = createServer({
      logger: createMemoryLogger(entries),
      correlationIdGenerator: createDeterministicCorrelationIdGenerator('test')
    });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('test-0001');

    const requestEntry = entries.find((entry) => entry.type === 'request');
    expect(requestEntry).toEqual({
      type: 'request',
      correlationId: 'test-0001',
      method: 'GET',
      path: '/health',
      statusCode: 200,
      durationMs: expect.any(Number)
    });

    await app.close();
  });

  it('logs run events with the active correlation id', async () => {
    const entries: StructuredLogEntry[] = [];
    const app = createServer({
      logger: createMemoryLogger(entries),
      correlationIdGenerator: createDeterministicCorrelationIdGenerator('test')
    });

    const response = await app.inject({
      method: 'POST',
      url: '/runs/run-1/events',
      headers: {
        'x-role': 'operator',
        'x-correlation-id': 'corr-custom'
      },
      payload: {
        event: 'started'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'logged',
      correlationId: 'corr-custom',
      runId: 'run-1',
      event: 'started'
    });

    const runEvent = entries.find((entry) => entry.type === 'run_event');
    expect(runEvent).toEqual({
      type: 'run_event',
      correlationId: 'corr-custom',
      runId: 'run-1',
      event: 'started'
    });

    await app.close();
  });

  it('does not emit run-event logs when payload is invalid', async () => {
    const entries: StructuredLogEntry[] = [];
    const app = createServer({
      logger: createMemoryLogger(entries),
      correlationIdGenerator: createDeterministicCorrelationIdGenerator('test')
    });

    const response = await app.inject({
      method: 'POST',
      url: '/runs/run-1/events',
      headers: {
        'x-role': 'operator',
        'x-correlation-id': '   '
      },
      payload: {
        event: '   '
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'event is required' });
    expect(response.headers['x-correlation-id']).toBe('test-0001');
    expect(entries.filter((entry) => entry.type === 'run_event')).toHaveLength(0);

    await app.close();
  });
});
