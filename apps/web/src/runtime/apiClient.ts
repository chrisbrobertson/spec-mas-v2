import type { LogEntry } from '../logStream.js';
import type { PhaseRecord, RunRecord } from '../runViews.js';

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
  role?: 'developer' | 'viewer' | 'operator' | 'admin';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  role: string
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-role': role,
      ...(init.headers ?? {})
    }
  });

  const responseText = await response.text();
  const parsed = responseText ? (JSON.parse(responseText) as unknown) : undefined;

  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status);
  }

  return parsed as T;
}

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}) {
  const role = options.role ?? 'developer';

  return {
    getHealth() {
      return requestJson<{ status: string }>(baseUrl, '/health', { method: 'GET' }, role);
    },
    getRuns() {
      return requestJson<RunsResponse>(baseUrl, '/runs', { method: 'GET' }, role);
    },
    getRunDetail(runId: string) {
      return requestJson<RunDetailResponse>(baseUrl, `/runs/${runId}`, { method: 'GET' }, role);
    },
    getRunArtifacts(runId: string) {
      return requestJson<RunArtifactsResponse>(baseUrl, `/runs/${runId}/artifacts`, { method: 'GET' }, role);
    },
    getRunLogs(runId: string) {
      return requestJson<RunLogsResponse>(baseUrl, `/runs/${runId}/logs`, { method: 'GET' }, role);
    },
    createSession(input: CreateSessionInput) {
      return requestJson<SessionRecord>(
        baseUrl,
        '/sessions',
        {
          method: 'POST',
          body: JSON.stringify(input)
        },
        role
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
        role
      );
    }
  };
}
