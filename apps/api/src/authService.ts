import type { Role } from './rbac.js';

export interface AuthSession {
  accessToken: string;
  role: Role;
  username: string;
  displayName: string;
  expiresAt: string;
}

export interface AuthLoginInput {
  username: string;
  password: string;
}

export interface AuthClock {
  nowMs(): number;
}

export interface TokenGenerator {
  next(): string;
}

export interface AuthUserRecord {
  password: string;
  role: Role;
  displayName: string;
}

export interface AuthServiceOptions {
  users?: Record<string, AuthUserRecord>;
  tokenTtlMs?: number;
  clock?: AuthClock;
  tokenGenerator?: TokenGenerator;
}

interface ActiveSession extends AuthSession {
  expiresAtMs: number;
}

const DEFAULT_USERS: Record<string, AuthUserRecord> = {
  admin: { password: 'admin', role: 'admin', displayName: 'Admin' },
  operator: { password: 'operator', role: 'operator', displayName: 'Operator' },
  developer: { password: 'developer', role: 'developer', displayName: 'Developer' },
  viewer: { password: 'viewer', role: 'viewer', displayName: 'Viewer' }
};

function padCounter(value: number): string {
  return value.toString().padStart(4, '0');
}

export function createDeterministicTokenGenerator(prefix = 'token'): TokenGenerator {
  let counter = 0;

  return {
    next() {
      counter += 1;
      return `${prefix}-${padCounter(counter)}`;
    }
  };
}

export function createSystemClock(): AuthClock {
  return {
    nowMs() {
      return Date.now();
    }
  };
}

export function createDeterministicAuthClock(startAtIso = '2026-01-01T00:00:00.000Z', stepMs = 1000): AuthClock {
  let currentMs = Date.parse(startAtIso);

  return {
    nowMs() {
      const value = currentMs;
      currentMs += stepMs;
      return value;
    }
  };
}

export type TokenValidationResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: 'invalid token' | 'session expired' };

export class InMemoryAuthService {
  private readonly users: Record<string, AuthUserRecord>;
  private readonly tokenTtlMs: number;
  private readonly clock: AuthClock;
  private readonly tokenGenerator: TokenGenerator;
  private readonly sessions = new Map<string, ActiveSession>();

  constructor(options: AuthServiceOptions = {}) {
    this.users = options.users ?? DEFAULT_USERS;
    this.tokenTtlMs = options.tokenTtlMs ?? 30 * 60 * 1000;
    this.clock = options.clock ?? createSystemClock();
    this.tokenGenerator = options.tokenGenerator ?? createDeterministicTokenGenerator('auth');
  }

  login(input: AuthLoginInput): AuthSession | undefined {
    const user = this.users[input.username];
    if (!user || user.password !== input.password) {
      return undefined;
    }

    const nowMs = this.clock.nowMs();
    const expiresAtMs = nowMs + this.tokenTtlMs;
    const session: ActiveSession = {
      accessToken: this.tokenGenerator.next(),
      role: user.role,
      username: input.username,
      displayName: user.displayName,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs
    };

    this.sessions.set(session.accessToken, session);
    return {
      accessToken: session.accessToken,
      role: session.role,
      username: session.username,
      displayName: session.displayName,
      expiresAt: session.expiresAt
    };
  }

  validate(accessToken: string): TokenValidationResult {
    const session = this.sessions.get(accessToken);
    if (!session) {
      return { ok: false, reason: 'invalid token' };
    }

    const nowMs = this.clock.nowMs();
    if (nowMs >= session.expiresAtMs) {
      this.sessions.delete(accessToken);
      return { ok: false, reason: 'session expired' };
    }

    return {
      ok: true,
      session: {
        accessToken: session.accessToken,
        role: session.role,
        username: session.username,
        displayName: session.displayName,
        expiresAt: session.expiresAt
      }
    };
  }
}
