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

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ specId: 'spec-1', mode: 'guided' }),
        headers: expect.objectContaining({
          'x-role': 'operator',
          'content-type': 'application/json'
        })
      })
    );
  });
});
