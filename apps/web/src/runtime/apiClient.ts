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

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  role: string,
  token: string | undefined,
  useRoleHeaderFallback: boolean,
  onUnauthorized?: (error: ApiError) => void
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('content-type', 'application/json');
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  } else if (useRoleHeaderFallback) {
    headers.set('x-role', role);
  }

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
