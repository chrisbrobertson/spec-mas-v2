export type LogEntryType = 'request' | 'run_event';

export interface RequestLogEntry {
  type: 'request';
  correlationId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export interface RunEventLogEntry {
  type: 'run_event';
  correlationId: string;
  runId: string;
  event: string;
}

export type StructuredLogEntry = RequestLogEntry | RunEventLogEntry;

export interface StructuredLogger {
  info(entry: StructuredLogEntry): void;
}

export interface CorrelationIdGenerator {
  next(): string;
}

function padCounter(value: number): string {
  return value.toString().padStart(4, '0');
}

export function createDeterministicCorrelationIdGenerator(prefix = 'corr'): CorrelationIdGenerator {
  let counter = 0;

  return {
    next() {
      counter += 1;
      return `${prefix}-${padCounter(counter)}`;
    }
  };
}

export function createConsoleLogger(): StructuredLogger {
  return {
    info(entry) {
      console.log(JSON.stringify(entry));
    }
  };
}

export function parseIncomingCorrelationId(headerValue: string | string[] | undefined): string | undefined {
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
