import { describe, expect, it } from 'vitest';
import { parseBearerToken } from '../src/rbac.js';
import { createServer } from '../src/server.js';

describe('rbac', () => {
  it('allows permitted roles on protected routes', async () => {
    const app = createServer();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        specId: 'spec-1'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<{ id: string }>();

    const loadResponse = await app.inject({
      method: 'GET',
      url: `/sessions/${created.id}`,
      headers: {
        'x-role': 'viewer'
      }
    });

    expect(loadResponse.statusCode).toBe(200);
    expect(loadResponse.json<{ specId: string }>().specId).toBe('spec-1');

    await app.close();
  });

  it('denies requests when role is missing', async () => {
    const app = createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      payload: {
        specId: 'spec-1'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'access denied: role is required' });

    await app.close();
  });

  it('denies requests for unknown roles', async () => {
    const app = createServer();

    const response = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'qa'
      },
      payload: {
        specId: 'spec-1'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'access denied: unknown role qa' });

    await app.close();
  });

  it('denies by default when route permissions are not configured', async () => {
    const app = createServer();

    const response = await app.inject({
      method: 'GET',
      url: '/internal/ping',
      headers: {
        'x-role': 'admin'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'access denied: route permission not configured' });

    await app.close();
  });

  it('keeps public probes accessible without auth', async () => {
    const app = createServer();

    const health = await app.inject({ method: 'GET', url: '/health' });
    const readyz = await app.inject({ method: 'GET', url: '/readyz' });

    expect(health.statusCode).toBe(200);
    expect(readyz.statusCode).toBe(200);

    await app.close();
  });

  it('parses bearer token edge cases', () => {
    expect(parseBearerToken('Bearer token-123')).toBe('token-123');
    expect(parseBearerToken('bearer token-456')).toBe('token-456');
    expect(parseBearerToken('Basic token')).toBeUndefined();
    expect(parseBearerToken('Bearer   ')).toBeUndefined();
  });
});
