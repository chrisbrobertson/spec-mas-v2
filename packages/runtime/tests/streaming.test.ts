import { describe, expect, it } from 'vitest';
import { InMemoryLogStore, LogStream, RuntimeLogPipeline, orderLogLines } from '../src/streaming.js';

describe('log streaming', () => {
  it('publishes logs to subscribers', () => {
    const stream = new LogStream();
    const seen: string[] = [];

    stream.subscribe((line) => seen.push(line.message));
    stream.publish({ runId: 'r1', taskId: 't1', sequence: 2, message: 'two', stream: 'stdout' });

    expect(seen).toEqual(['two']);
  });

  it('orders log lines by sequence', () => {
    const ordered = orderLogLines([
      { runId: 'r1', taskId: 't1', sequence: 3, message: 'three', stream: 'stdout' },
      { runId: 'r1', taskId: 't1', sequence: 1, message: 'one', stream: 'stdout' }
    ]);

    expect(ordered.map((line) => line.message)).toEqual(['one', 'three']);
  });

  it('persists ordered logs in pipeline store', () => {
    const stream = new LogStream();
    const store = new InMemoryLogStore();
    const pipeline = new RuntimeLogPipeline(stream, store);

    pipeline.publish({ runId: 'r1', taskId: 't1', sequence: 2, message: 'two', stream: 'stderr' });
    pipeline.publish({ runId: 'r1', taskId: 't1', sequence: 1, message: 'one', stream: 'stdout' });

    expect(pipeline.read('r1', 't1').map((line) => line.message)).toEqual(['one', 'two']);
  });
});
