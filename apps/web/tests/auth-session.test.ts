import { describe, expect, it } from 'vitest';
import { canWriteSessions, isSessionExpired, parseStoredSession } from '../src/runtime/authSession.js';

describe('auth-session', () => {
  it('parses valid non-expired sessions on happy path', () => {
    const session = parseStoredSession(
      JSON.stringify({
        accessToken: 'auth-0001',
        role: 'developer',
        username: 'developer',
        displayName: 'Developer',
        expiresAt: '2026-01-01T00:05:00.000Z'
      }),
      '2026-01-01T00:00:00.000Z'
    );

    expect(session).toEqual({
      accessToken: 'auth-0001',
      role: 'developer',
      username: 'developer',
      displayName: 'Developer',
      expiresAt: '2026-01-01T00:05:00.000Z'
    });
  });

  it('returns undefined for malformed or incomplete failure-path payloads', () => {
    expect(parseStoredSession('{invalid-json', '2026-01-01T00:00:00.000Z')).toBeUndefined();
    expect(parseStoredSession(JSON.stringify({ role: 'developer' }), '2026-01-01T00:00:00.000Z')).toBeUndefined();
  });

  it('enforces expiry and role write access edge behavior', () => {
    expect(isSessionExpired('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(true);
    expect(isSessionExpired('2026-01-01T00:05:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
    expect(canWriteSessions('viewer')).toBe(false);
    expect(canWriteSessions('admin')).toBe(true);
  });
});
