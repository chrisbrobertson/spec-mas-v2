import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import {
  createConsoleLogger,
  createDeterministicCorrelationIdGenerator,
  parseIncomingCorrelationId,
  type CorrelationIdGenerator,
  type StructuredLogger
} from './logging.js';
import { authorize, isPublicPath, parseBearerToken, parseRole, type Permission } from './rbac.js';
import {
  InMemoryConversationSessionService,
  createDeterministicSessionClock,
  createDeterministicSessionIdGenerator,
  type AuthoringMode
} from './sessionService.js';
import { InMemoryAuthService } from './authService.js';
import { PrismaRunQueryService, type RunQueryService } from './runQueryService.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestCorrelationId: string;
    requestStartTimeNs: bigint;
  }
}

interface GuardedRouteConfig {
  requiredPermission?: Permission;
}

export interface CreateServerOptions {
  logger?: StructuredLogger;
  correlationIdGenerator?: CorrelationIdGenerator;
  sessionService?: InMemoryConversationSessionService;
  authService?: InMemoryAuthService;
  corsOrigin?: string | string[] | boolean;
  runQueryService?: RunQueryService;
}

function getPermission(request: FastifyRequest): Permission | undefined {
  const config = request.routeOptions.config as GuardedRouteConfig | undefined;
  return config?.requiredPermission;
}

function resolvePathname(url: string): string {
  const [pathname] = url.split('?');
  return pathname;
}

function parseRawHeaderValue(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isAuthoringMode(value: string | undefined): value is AuthoringMode {
  return value === 'guided' || value === 'edit' || value === 'freeform';
}

export function createServer(options: CreateServerOptions = {}) {
  const logger = options.logger ?? createConsoleLogger();
  const correlationIdGenerator = options.correlationIdGenerator ?? createDeterministicCorrelationIdGenerator('req');
  const sessionService =
    options.sessionService ??
    new InMemoryConversationSessionService(
      createDeterministicSessionIdGenerator('session'),
      createDeterministicSessionClock()
    );
  const authService = options.authService ?? new InMemoryAuthService();
  const runQueryService = options.runQueryService ?? new PrismaRunQueryService();

  const app = Fastify();
  app.register(cors, { origin: options.corsOrigin ?? 'http://localhost:3000' });

  app.addHook('onClose', async () => {
    if (runQueryService.close) {
      await runQueryService.close();
    }
  });

  app.decorateRequest('requestCorrelationId', '');
  app.decorateRequest('requestStartTimeNs', 0n);

  app.addHook('onRequest', async (request, reply) => {
    const incoming = parseIncomingCorrelationId(request.headers['x-correlation-id']);
    const correlationId = incoming ?? correlationIdGenerator.next();
    request.requestCorrelationId = correlationId;
    request.requestStartTimeNs = process.hrtime.bigint();
    reply.header('x-correlation-id', correlationId);
  });

  app.addHook('preHandler', async (request, reply) => {
    const pathname = request.routeOptions.url ?? resolvePathname(request.url);

    if (isPublicPath(pathname)) {
      return;
    }

    const requiredPermission = getPermission(request);

    const accessToken = parseBearerToken(request.headers.authorization);
    const roleHeader = parseRawHeaderValue(request.headers['x-role']);
    let role = parseRole(roleHeader);

    if (accessToken) {
      const validation = authService.validate(accessToken);
      if (!validation.ok) {
        reply.status(401).send({ error: validation.reason });
        return;
      }
      role = validation.session.role;
    } else if (roleHeader && !role) {
      reply.status(403).send({ error: `access denied: unknown role ${roleHeader}` });
      return;
    }

    const decision = authorize(role, requiredPermission);
    if (!decision.allowed) {
      reply.status(403).send({ error: decision.reason });
      return;
    }
  });

  app.addHook('onResponse', async (request, reply) => {
    const durationNs = process.hrtime.bigint() - request.requestStartTimeNs;
    const durationMs = Number(durationNs / 1000000n);

    logger.info({
      type: 'request',
      correlationId: request.requestCorrelationId,
      method: request.method,
      path: resolvePathname(request.url),
      statusCode: reply.statusCode,
      durationMs
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/readyz', async () => ({ status: 'ready' }));

  app.post<{ Body: { username?: string; password?: string } }>('/auth/login', async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    if (!username || !password) {
      reply.status(400).send({ error: 'username and password are required' });
      return;
    }

    const session = authService.login({ username, password });
    if (!session) {
      reply.status(401).send({ error: 'invalid credentials' });
      return;
    }

    return session;
  });

  app.get('/internal/ping', async () => ({ status: 'pong' }));

  app.get(
    '/runs',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async () => ({
      runs: await runQueryService.listRuns()
    })
  );

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const run = await runQueryService.loadRun(request.params.runId);
      if (!run) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      return {
        run,
        phases: await runQueryService.loadRunPhases(request.params.runId)
      };
    }
  );

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId/artifacts',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const payload = await runQueryService.loadRunArtifacts(request.params.runId);
      if (!payload) {
        reply.status(404).send({ error: `artifacts not found: ${request.params.runId}` });
        return;
      }

      return payload;
    }
  );

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId/logs',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const run = await runQueryService.loadRun(request.params.runId);
      if (!run) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      return {
        runId: request.params.runId,
        entries: await runQueryService.loadRunLogs(request.params.runId)
      };
    }
  );

  app.get<{ Params: { runId: string }; Querystring: { after?: string } }>(
    '/runs/:runId/logs/stream',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const run = await runQueryService.loadRun(request.params.runId);
      if (!run) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      const afterRaw = request.query?.after?.trim();
      if (!afterRaw) {
        const entries = await runQueryService.loadRunLogsAfter(request.params.runId, 0);
        const payload = entries
          .map((entry) => `event: log\nid: ${entry.sequence}\ndata: ${JSON.stringify(entry)}\n\n`)
          .join('');
        reply.header('content-type', 'text/event-stream; charset=utf-8');
        reply.header('cache-control', 'no-cache');
        return `${payload}event: end\ndata: ${JSON.stringify({ delivered: entries.length })}\n\n`;
      }

      const parsedAfter = Number(afterRaw);
      if (!Number.isInteger(parsedAfter) || parsedAfter < 0) {
        reply.status(400).send({ error: `invalid after sequence: ${afterRaw}` });
        return;
      }

      const entries = await runQueryService.loadRunLogsAfter(request.params.runId, parsedAfter);
      const payload = entries
        .map((entry) => `event: log\nid: ${entry.sequence}\ndata: ${JSON.stringify(entry)}\n\n`)
        .join('');

      reply.header('content-type', 'text/event-stream; charset=utf-8');
      reply.header('cache-control', 'no-cache');
      return `${payload}event: end\ndata: ${JSON.stringify({ delivered: entries.length })}\n\n`;
    }
  );

  app.post<{ Params: { runId: string }; Body: { event?: string } }>(
    '/runs/:runId/events',
    {
      config: {
        requiredPermission: 'run:event:write'
      }
    },
    async (request, reply) => {
      const event = request.body?.event?.trim();
      if (!event) {
        reply.status(400).send({ error: 'event is required' });
        return;
      }

      logger.info({
        type: 'run_event',
        correlationId: request.requestCorrelationId,
        runId: request.params.runId,
        event
      });

      return {
        status: 'logged',
        correlationId: request.requestCorrelationId,
        runId: request.params.runId,
        event
      };
    }
  );

  app.post<{ Body: { specId?: string; mode?: string; seedMessage?: string } }>(
    '/sessions',
    {
      config: {
        requiredPermission: 'session:write'
      }
    },
    async (request, reply) => {
      const specId = request.body?.specId?.trim();
      if (!specId) {
        reply.status(400).send({ error: 'specId is required' });
        return;
      }

      const mode = request.body?.mode?.trim();
      if (mode && !isAuthoringMode(mode)) {
        reply.status(400).send({ error: `invalid mode: ${mode}` });
        return;
      }

      const parsedMode = mode && isAuthoringMode(mode) ? mode : undefined;

      const session = sessionService.create({
        specId,
        mode: parsedMode,
        seedMessage: request.body?.seedMessage
      });

      reply.status(201);
      return session;
    }
  );

  app.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const session = sessionService.load(request.params.sessionId);
      if (!session) {
        reply.status(404).send({ error: `session not found: ${request.params.sessionId}` });
        return;
      }

      return session;
    }
  );

  app.post<{ Params: { sessionId: string }; Body: { message?: string } }>(
    '/sessions/:sessionId/resume',
    {
      config: {
        requiredPermission: 'session:write'
      }
    },
    async (request, reply) => {
      const message = request.body?.message?.trim();
      if (request.body?.message && !message) {
        reply.status(400).send({ error: 'message cannot be blank' });
        return;
      }

      const session = sessionService.resume(request.params.sessionId, { message });
      if (!session) {
        reply.status(404).send({ error: `session not found: ${request.params.sessionId}` });
        return;
      }

      return session;
    }
  );

  return app;
}
