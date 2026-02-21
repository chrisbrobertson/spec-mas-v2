import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

describe('runtime readiness endpoint', () => {
  it('returns readiness payload for authorized roles on happy path', async () => {
    const app = createServer({
      runtimeReadinessProvider: async () => ({
        ready: true,
        dockerRequired: true,
        openhandsEnabled: true,
        checks: [{ name: 'docker', ok: true, message: 'ok' }]
      })
    });

    const response = await app.inject({
      method: 'GET',
      url: '/runtime/readiness',
      headers: {
        'x-role': 'viewer'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ready: true,
      dockerRequired: true,
      openhandsEnabled: true,
      checks: [{ name: 'docker', ok: true, message: 'ok' }]
    });

    await app.close();
  });

  it('denies readiness requests when role is missing', async () => {
    const app = createServer({
      runtimeReadinessProvider: async () => ({
        ready: true,
        dockerRequired: false,
        openhandsEnabled: false,
        checks: []
      })
    });

    const response = await app.inject({
      method: 'GET',
      url: '/runtime/readiness'
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'access denied: role is required' });

    await app.close();
  });
});
