import type { LogEntry } from '../logStream.js';
import type { PhaseRecord, RunRecord } from '../runViews.js';
import type { UserRole } from './authSession.js';

export interface RunsResponse {
  runs: RunRecord[];
}

export interface RunDetailResponse {
  run: RunRecord;
  phases: PhaseRecord[];
}

export interface RunArtifactsResponse {
  runId: string;
  paths: string[];
  contents: Record<string, string>;
}

export interface RunLogsResponse {
  runId: string;
  entries: LogEntry[];
}

export interface RunLogStreamResponse {
  entries: LogEntry[];
  delivered: number;
}

export type AuthoringMode = 'guided' | 'edit' | 'freeform';

export interface SessionRecord {
  id: string;
  specId: string;
  mode: AuthoringMode;
  status: 'active';
  createdAt: string;
  updatedAt: string;
  resumedAt: string;
  messages: string[];
}

export interface CreateSessionInput {
  specId: string;
  mode?: AuthoringMode;
  seedMessage?: string;
}

export interface ResumeSessionInput {
  message?: string;
}

export interface ApiClientOptions {
  role?: UserRole;
  tokenProvider?: () => string | undefined;
  onUnauthorized?: (error: ApiError) => void;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  role: UserRole;
  username: string;
  displayName: string;
  expiresAt: string;
}

function buildRequestHeaders(role: string, token: string | undefined, useRoleHeaderFallback: boolean, initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders ?? {});
  headers.set('content-type', 'application/json');
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  } else if (useRoleHeaderFallback) {
    headers.set('x-role', role);
  }

  return headers;
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  role: string,
  token: string | undefined,
  useRoleHeaderFallback: boolean,
  onUnauthorized?: (error: ApiError) => void
): Promise<T> {
  const headers = buildRequestHeaders(role, token, useRoleHeaderFallback, init.headers);

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  const responseText = await response.text();
  const parsed = responseText ? (JSON.parse(responseText) as unknown) : undefined;

  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `${response.status} ${response.statusText}`;
    const apiError = new ApiError(message, response.status);
    if (apiError.statusCode === 401) {
      onUnauthorized?.(apiError);
    }
    throw apiError;
  }

  return parsed as T;
}

async function requestText(
  baseUrl: string,
  path: string,
  init: RequestInit,
  role: string,
  token: string | undefined,
  useRoleHeaderFallback: boolean,
  onUnauthorized?: (error: ApiError) => void
): Promise<string> {
  const headers = buildRequestHeaders(role, token, useRoleHeaderFallback, init.headers);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  const responseText = await response.text();
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;

    try {
      const parsed = responseText ? (JSON.parse(responseText) as { error?: unknown }) : undefined;
      if (parsed && parsed.error) {
        message = String(parsed.error);
      }
    } catch {
      // ignore non-json payloads
    }

    const apiError = new ApiError(message, response.status);
    if (apiError.statusCode === 401) {
      onUnauthorized?.(apiError);
    }
    throw apiError;
  }

  return responseText;
}

export function parseSseLogPayload(payload: string): RunLogStreamResponse {
  const entries: LogEntry[] = [];
  let delivered = 0;
  const blocks = payload
    .split('\n\n')
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  for (const block of blocks) {
    const lines = block.split('\n');
    let eventType = '';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice('data:'.length).trim();
      }
    }

    if (!data) {
      continue;
    }

    const parsed = JSON.parse(data) as unknown;
    if (eventType === 'log') {
      entries.push(parsed as LogEntry);
    } else if (eventType === 'end' && parsed && typeof parsed === 'object' && 'delivered' in parsed) {
      delivered = Number((parsed as { delivered: unknown }).delivered) || 0;
    }
  }

  return {
    entries,
    delivered
  };
}

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}) {
  const role = options.role ?? 'developer';
  const getToken = options.tokenProvider ?? (() => undefined);
  const useRoleHeaderFallback = !options.tokenProvider;

  return {
    getHealth() {
      return requestJson<{ status: string }>(
        baseUrl,
        '/health',
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    login(input: LoginInput) {
      return requestJson<LoginResponse>(
        baseUrl,
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(input)
        },
        role,
        undefined,
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    getRuns() {
      return requestJson<RunsResponse>(
        baseUrl,
        '/runs',
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    getRunDetail(runId: string) {
      return requestJson<RunDetailResponse>(
        baseUrl,
        `/runs/${runId}`,
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    getRunArtifacts(runId: string) {
      return requestJson<RunArtifactsResponse>(
        baseUrl,
        `/runs/${runId}/artifacts`,
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    getRunLogs(runId: string) {
      return requestJson<RunLogsResponse>(
        baseUrl,
        `/runs/${runId}/logs`,
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    async getRunLogStream(runId: string, afterSequence = 0) {
      const payload = await requestText(
        baseUrl,
        `/runs/${runId}/logs/stream?after=${afterSequence}`,
        { method: 'GET' },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
      return parseSseLogPayload(payload);
    },
    createSession(input: CreateSessionInput) {
      return requestJson<SessionRecord>(
        baseUrl,
        '/sessions',
        {
          method: 'POST',
          body: JSON.stringify(input)
        },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    getSession(sessionId: string) {
      return requestJson<SessionRecord>(
        baseUrl,
        `/sessions/${sessionId}`,
        {
          method: 'GET'
        },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    },
    resumeSession(sessionId: string, input: ResumeSessionInput) {
      return requestJson<SessionRecord>(
        baseUrl,
        `/sessions/${sessionId}/resume`,
        {
          method: 'POST',
          body: JSON.stringify(input)
        },
        role,
        getToken(),
        useRoleHeaderFallback,
        options.onUnauthorized
      );
    }
  };
}
