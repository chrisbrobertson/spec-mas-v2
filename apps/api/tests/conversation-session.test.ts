import { describe, expect, it } from 'vitest';
import {
  InMemoryConversationSessionService,
  createDeterministicSessionClock,
  createDeterministicSessionIdGenerator
} from '../src/sessionService.js';
import { createServer } from '../src/server.js';

describe('conversation-session', () => {
  it('supports create, load, and resume semantics', async () => {
    const sessionService = new InMemoryConversationSessionService(
      createDeterministicSessionIdGenerator('sess'),
      createDeterministicSessionClock('2026-01-01T00:00:00.000Z', 1000)
    );
    const app = createServer({ sessionService });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        specId: 'spec-payments',
        seedMessage: 'Start guided draft'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toEqual({
      id: 'sess-0001',
      specId: 'spec-payments',
      mode: 'guided',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      resumedAt: '2026-01-01T00:00:00.000Z',
      messages: ['Start guided draft']
    });

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/sessions/sess-0001/resume',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        message: 'Continue with constraints'
      }
    });

    expect(resumeResponse.statusCode).toBe(200);
    expect(resumeResponse.json()).toEqual({
      id: 'sess-0001',
      specId: 'spec-payments',
      mode: 'guided',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      resumedAt: '2026-01-01T00:00:01.000Z',
      messages: ['Start guided draft', 'Continue with constraints']
    });

    const loadResponse = await app.inject({
      method: 'GET',
      url: '/sessions/sess-0001',
      headers: {
        'x-role': 'viewer'
      }
    });

    expect(loadResponse.statusCode).toBe(200);
    expect(loadResponse.json<{ id: string }>().id).toBe('sess-0001');

    await app.close();
  });

  it('returns validation errors for invalid create payloads', async () => {
    const app = createServer();

    const missingSpecId = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'developer'
      },
      payload: {}
    });

    expect(missingSpecId.statusCode).toBe(400);
    expect(missingSpecId.json()).toEqual({ error: 'specId is required' });

    const invalidMode = await app.inject({
      method: 'POST',
      url: '/sessions',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        specId: 'spec-1',
        mode: 'wizard'
      }
    });

    expect(invalidMode.statusCode).toBe(400);
    expect(invalidMode.json()).toEqual({ error: 'invalid mode: wizard' });

    await app.close();
  });

  it('returns not found and edge validation for resume', async () => {
    const app = createServer();

    const blankMessage = await app.inject({
      method: 'POST',
      url: '/sessions/session-404/resume',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        message: '  '
      }
    });

    expect(blankMessage.statusCode).toBe(400);
    expect(blankMessage.json()).toEqual({ error: 'message cannot be blank' });

    const missingSession = await app.inject({
      method: 'POST',
      url: '/sessions/session-404/resume',
      headers: {
        'x-role': 'developer'
      },
      payload: {
        message: 'resume'
      }
    });

    expect(missingSession.statusCode).toBe(404);
    expect(missingSession.json()).toEqual({ error: 'session not found: session-404' });

    const missingLoad = await app.inject({
      method: 'GET',
      url: '/sessions/session-404',
      headers: {
        'x-role': 'viewer'
      }
    });

    expect(missingLoad.statusCode).toBe(404);
    expect(missingLoad.json()).toEqual({ error: 'session not found: session-404' });

    await app.close();
  });
});
