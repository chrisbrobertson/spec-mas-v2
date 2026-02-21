import { describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';

describe('api health endpoints', () => {
  it('returns health', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['x-correlation-id']).toBe('req-0001');

    await app.close();
  });

  it('returns readiness', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/readyz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready' });

    await app.close();
  });

  it('keeps caller correlation id when provided', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-correlation-id': 'incoming-42'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('incoming-42');

    await app.close();
  });

  it('allows default configured cors origin', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    await app.close();
  });

  it('does not emit cors header when cors is disabled', async () => {
    const app = createServer({ corsOrigin: false });
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3000'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('supports cors origin override edge case', async () => {
    const app = createServer({ corsOrigin: 'http://localhost:3300' });
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        origin: 'http://localhost:3300'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3300');

    await app.close();
  });
});
