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
import { InMemoryMergeApprovalService, type MergeApprovalService } from './mergeApprovalService.js';
import { PrismaRunQueryService, type RunQueryService } from './runQueryService.js';
import { PrismaRunControlService, type RunControlService } from './runControlService.js';
import { evaluateRuntimeReadiness, type RuntimeReadinessResult } from './runtimeReadiness.js';

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
  runControlService?: RunControlService;
  mergeApprovalService?: MergeApprovalService;
  runtimeReadinessProvider?: () => Promise<RuntimeReadinessResult>;
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
  const runControlService = options.runControlService ?? new PrismaRunControlService();
  const mergeApprovalService = options.mergeApprovalService ?? new InMemoryMergeApprovalService();
  const runtimeReadinessProvider = options.runtimeReadinessProvider ?? (() => evaluateRuntimeReadiness());

  const app = Fastify();
  app.register(cors, { origin: options.corsOrigin ?? 'http://localhost:3000' });

  app.addHook('onClose', async () => {
    if (runQueryService.close) {
      await runQueryService.close();
    }
    if (runControlService.close) {
      await runControlService.close();
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

  app.get(
    '/runtime/readiness',
    {
      config: {
        requiredPermission: 'system:inspect'
      }
    },
    async () => runtimeReadinessProvider()
  );

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

  app.get<{ Querystring: { projectId?: string; branch?: string } }>(
    '/runs',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request) => {
      const runs = await runQueryService.listRuns({
        projectId: request.query?.projectId?.trim() || undefined,
        branch: request.query?.branch?.trim() || undefined
      });
      return {
        runs: runs.map((run) => ({
          ...run,
          mergeStatus: mergeApprovalService.getStatus(run.id, run.status)
        }))
      };
    }
  );

  app.post<{ Body: { projectId?: string; specId?: string; initiatedBy?: string } }>(
    '/runs',
    {
      config: {
        requiredPermission: 'session:write'
      }
    },
    async (request, reply) => {
      const projectId = request.body?.projectId?.trim();
      if (!projectId) {
        reply.status(400).send({ error: 'projectId is required' });
        return;
      }

      try {
        const readiness = await runtimeReadinessProvider();
        if (!readiness.ready) {
          reply.status(503).send({
            error: 'runtime readiness check failed',
            readiness
          });
          return;
        }

        const started = await runControlService.startRun({
          projectId,
          specId: request.body?.specId?.trim() || undefined,
          initiatedBy: request.body?.initiatedBy?.trim() || undefined
        });

        const run = await runQueryService.loadRun(started.runId);
        if (!run) {
          reply.status(500).send({ error: `run persisted but not readable: ${started.runId}` });
          return;
        }

        reply.status(201).send({
          run: {
            ...run,
            mergeStatus: mergeApprovalService.getStatus(run.id, run.status)
          }
        });
      } catch (error) {
        reply.status(400).send({ error: error instanceof Error ? error.message : 'failed to start run' });
      }
    }
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
        run: {
          ...run,
          mergeStatus: mergeApprovalService.getStatus(run.id, run.status)
        },
        phases: await runQueryService.loadRunPhases(request.params.runId)
      };
    }
  );

  app.get(
    '/projects',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async () => ({
      projects: await runQueryService.listProjects()
    })
  );

  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const project = await runQueryService.loadProject(request.params.projectId);
      if (!project) {
        reply.status(404).send({ error: `project not found: ${request.params.projectId}` });
        return;
      }
      return { project };
    }
  );

  app.get<{ Params: { projectId: string } }>(
    '/projects/:projectId/branches',
    {
      config: {
        requiredPermission: 'session:read'
      }
    },
    async (request, reply) => {
      const branches = await runQueryService.loadProjectBranches(request.params.projectId);
      if (!branches) {
        reply.status(404).send({ error: `project not found: ${request.params.projectId}` });
        return;
      }
      return branches;
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

  app.get<{ Params: { runId: string } }>(
    '/runs/:runId/merge-approval',
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
      return mergeApprovalService.getRecord(run.id, run.status);
    }
  );

  app.post<{ Params: { runId: string }; Body: { action?: 'approve' | 'reject' | 'merge' } }>(
    '/runs/:runId/merge-approval',
    {
      config: {
        requiredPermission: 'run:event:write'
      }
    },
    async (request, reply) => {
      const run = await runQueryService.loadRun(request.params.runId);
      if (!run) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      const action = request.body?.action;
      if (!action || !['approve', 'reject', 'merge'].includes(action)) {
        reply.status(400).send({ error: 'action must be approve, reject, or merge' });
        return;
      }

      try {
        return mergeApprovalService.transition(run.id, action, run.status);
      } catch (error) {
        reply.status(409).send({
          error: error instanceof Error ? error.message : 'merge approval transition failed'
        });
      }
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

  app.post<{ Params: { runId: string } }>(
    '/runs/:runId/cancel',
    {
      config: {
        requiredPermission: 'session:write'
      }
    },
    async (request, reply) => {
      const cancelled = await runControlService.cancelRun(request.params.runId);
      if (!cancelled) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      const run = await runQueryService.loadRun(request.params.runId);
      if (!run) {
        reply.status(404).send({ error: `run not found: ${request.params.runId}` });
        return;
      }

      return {
        run: {
          ...run,
          mergeStatus: mergeApprovalService.getStatus(run.id, run.status)
        }
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
