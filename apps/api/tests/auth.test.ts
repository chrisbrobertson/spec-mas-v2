import { describe, expect, it } from 'vitest';
import {
  InMemoryAuthService,
  createDeterministicAuthClock,
  createDeterministicTokenGenerator
} from '../src/authService.js';
import { createServer } from '../src/server.js';

describe('auth', () => {
  it('supports login and bearer token access on happy path', async () => {
    const authService = new InMemoryAuthService({
      clock: createDeterministicAuthClock('2026-01-01T00:00:00.000Z', 100),
      tokenGenerator: createDeterministicTokenGenerator('auth'),
      tokenTtlMs: 10_000
    });
    const app = createServer({ authService });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'developer',
        password: 'developer'
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toEqual({
      accessToken: 'auth-0001',
      role: 'developer',
      username: 'developer',
      displayName: 'Developer',
      expiresAt: '2026-01-01T00:00:10.000Z'
    });

    const createSession = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        authorization: 'Bearer auth-0001'
      },
      payload: {
        specId: 'spec-auth'
      }
    });

    expect(createSession.statusCode).toBe(201);

    await app.close();
  });

  it('rejects invalid credentials in failure path', async () => {
    const app = createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'developer',
        password: 'wrong-password'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'invalid credentials' });

    await app.close();
  });

  it('returns session expired on edge-case token expiry', async () => {
    const authService = new InMemoryAuthService({
      clock: createDeterministicAuthClock('2026-01-01T00:00:00.000Z', 1000),
      tokenGenerator: createDeterministicTokenGenerator('auth'),
      tokenTtlMs: 1000
    });
    const app = createServer({ authService });

    await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        username: 'viewer',
        password: 'viewer'
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/runs',
      headers: {
        authorization: 'Bearer auth-0001'
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'session expired' });

    await app.close();
  });
});
