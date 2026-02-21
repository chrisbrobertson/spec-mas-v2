export type AuthoringMode = 'guided' | 'edit' | 'freeform';

export interface ConversationSession {
  id: string;
  specId: string;
  mode: AuthoringMode;
  status: 'active';
  createdAt: string;
  updatedAt: string;
  resumedAt: string;
  messages: string[];
}

export interface SessionCreateInput {
  specId: string;
  mode?: AuthoringMode;
  seedMessage?: string;
}

export interface SessionResumeInput {
  message?: string;
}

export interface SessionIdGenerator {
  next(): string;
}

export interface SessionClock {
  now(): string;
}

function padCounter(value: number): string {
  return value.toString().padStart(4, '0');
}

export function createDeterministicSessionIdGenerator(prefix = 'session'): SessionIdGenerator {
  let counter = 0;

  return {
    next() {
      counter += 1;
      return `${prefix}-${padCounter(counter)}`;
    }
  };
}

export function createDeterministicSessionClock(
  startAtIso = '2026-01-01T00:00:00.000Z',
  stepMs = 1000
): SessionClock {
  let current = Date.parse(startAtIso);

  return {
    now() {
      const value = new Date(current).toISOString();
      current += stepMs;
      return value;
    }
  };
}

export class InMemoryConversationSessionService {
  private readonly sessions = new Map<string, ConversationSession>();

  constructor(
    private readonly idGenerator: SessionIdGenerator,
    private readonly clock: SessionClock
  ) {}

  create(input: SessionCreateInput): ConversationSession {
    const id = this.idGenerator.next();
    const timestamp = this.clock.now();
    const messages = input.seedMessage ? [input.seedMessage] : [];

    const session: ConversationSession = {
      id,
      specId: input.specId,
      mode: input.mode ?? 'guided',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      resumedAt: timestamp,
      messages
    };

    this.sessions.set(id, session);
    return session;
  }

  load(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  resume(sessionId: string, input: SessionResumeInput): ConversationSession | undefined {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return undefined;
    }

    const timestamp = this.clock.now();
    const nextMessages = input.message ? [...existing.messages, input.message] : existing.messages;

    const updated: ConversationSession = {
      ...existing,
      updatedAt: timestamp,
      resumedAt: timestamp,
      messages: nextMessages
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }
}
