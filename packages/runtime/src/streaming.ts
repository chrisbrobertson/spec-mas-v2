export interface LogLine {
  runId: string;
  taskId: string;
  sequence: number;
  message: string;
  stream: 'stdout' | 'stderr';
}

type LogSubscriber = (line: LogLine) => void;

export class LogStream {
  private readonly subscribers = new Set<LogSubscriber>();

  subscribe(handler: LogSubscriber): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  publish(line: LogLine): void {
    for (const subscriber of this.subscribers) {
      subscriber(line);
    }
  }
}

function logKey(runId: string, taskId: string): string {
  return `${runId}::${taskId}`;
}

export class InMemoryLogStore {
  private readonly linesByTask = new Map<string, LogLine[]>();

  append(line: LogLine): void {
    const key = logKey(line.runId, line.taskId);
    const current = this.linesByTask.get(key) ?? [];
    current.push(line);
    this.linesByTask.set(key, orderLogLines(current));
  }

  read(runId: string, taskId: string): LogLine[] {
    return [...(this.linesByTask.get(logKey(runId, taskId)) ?? [])];
  }
}

export class RuntimeLogPipeline {
  constructor(
    private readonly stream: LogStream,
    private readonly store: InMemoryLogStore
  ) {}

  publish(line: LogLine): void {
    this.store.append(line);
    this.stream.publish(line);
  }

  read(runId: string, taskId: string): LogLine[] {
    return this.store.read(runId, taskId);
  }
}

export function orderLogLines(lines: LogLine[]): LogLine[] {
  return [...lines].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    if (left.runId !== right.runId) {
      return left.runId.localeCompare(right.runId);
    }
    if (left.taskId !== right.taskId) {
      return left.taskId.localeCompare(right.taskId);
    }
    return left.message.localeCompare(right.message);
  });
}
