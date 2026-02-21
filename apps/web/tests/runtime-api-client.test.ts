import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/runtime/apiClient.js';

describe('runtime-api-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches typed run data on happy path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ runs: [{ id: 'run-2', projectId: 'alpha', status: 'running', startedAt: 'x' }] }), {
        status: 200
      })
    );

    const client = createApiClient('http://localhost:3100');
    const response = await client.getRuns();

    expect(response.runs[0].id).toBe('run-2');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/runs',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('surfaces api errors for failure paths', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'run not found: run-999' }), {
        status: 404,
        statusText: 'Not Found'
      })
    );

    const client = createApiClient('http://localhost:3100');

    await expect(client.getRunDetail('run-999')).rejects.toEqual(
      expect.objectContaining({
        message: 'run not found: run-999',
        statusCode: 404
      })
    );
  });

  it('sends role and payload headers for session operations edge case', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'session-0001',
          specId: 'spec-1',
          mode: 'guided',
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          resumedAt: '2026-01-01T00:00:00.000Z',
          messages: []
        }),
        { status: 201 }
      )
    );

    const client = createApiClient('http://localhost:3100', { role: 'operator' });
    await client.createSession({ specId: 'spec-1', mode: 'guided' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ specId: 'spec-1', mode: 'guided' })
      })
    );
    expect(headers.get('x-role')).toBe('operator');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('logs in and returns typed auth session data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'auth-0001',
          role: 'developer',
          username: 'developer',
          displayName: 'Developer',
          expiresAt: '2026-01-01T00:30:00.000Z'
        }),
        { status: 200 }
      )
    );

    const client = createApiClient('http://localhost:3100');
    const response = await client.login({ username: 'developer', password: 'developer' });

    expect(response.accessToken).toBe('auth-0001');
    expect(response.role).toBe('developer');
  });

  it('uses bearer token and calls unauthorized handler in failure path', async () => {
    const onUnauthorized = vi.fn();
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'session expired' }), {
        status: 401,
        statusText: 'Unauthorized'
      })
    );

    const client = createApiClient('http://localhost:3100', {
      tokenProvider: () => 'auth-0001',
      onUnauthorized
    });

    await expect(client.getRuns()).rejects.toEqual(
      expect.objectContaining({
        message: 'session expired',
        statusCode: 401
      })
    );

    expect(onUnauthorized).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((init as RequestInit | undefined)?.headers);
    expect(headers.get('authorization')).toBe('Bearer auth-0001');
  });
});
