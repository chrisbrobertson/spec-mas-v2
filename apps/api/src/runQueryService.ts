import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type PhaseStatus as PrismaPhaseStatus, type RunStatus as PrismaRunStatus } from '@prisma/client';

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type LogLevel = 'info' | 'warn' | 'error';

export interface RunRecord {
  id: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
}

export interface PhaseRecord {
  id: string;
  runId: string;
  name: string;
  status: PhaseStatus;
  sequence: number;
}

export interface LogEntry {
  runId: string;
  sequence: number;
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface ArtifactPayload {
  runId: string;
  paths: string[];
  contents: Record<string, string>;
}

export interface RunQueryService {
  listRuns(): Promise<RunRecord[]>;
  loadRun(runId: string): Promise<RunRecord | undefined>;
  loadRunPhases(runId: string): Promise<PhaseRecord[]>;
  loadRunLogs(runId: string): Promise<LogEntry[]>;
  loadRunLogsAfter(runId: string, afterSequence: number): Promise<LogEntry[]>;
  loadRunArtifacts(runId: string): Promise<ArtifactPayload | undefined>;
  close?(): Promise<void>;
}

interface SeedRun {
  run: RunRecord;
  phases?: Omit<PhaseRecord, 'sequence'>[];
  logs?: LogEntry[];
  artifacts?: ArtifactPayload;
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, 'artifacts', 'runs');

function normalizeIso(input: string | Date | null | undefined): string {
  if (!input) {
    return new Date(0).toISOString();
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  return input;
}

function mapRunStatus(status: PrismaRunStatus): RunStatus {
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'pending':
    case 'paused':
      return 'queued';
  }
}

function mapPhaseStatus(status: PrismaPhaseStatus): PhaseStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'running':
      return 'running';
    case 'completed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'skipped':
    case 'cancelled':
      return 'skipped';
  }
}

function fallbackArtifactContent(path: string): string {
  if (path.endsWith('.json')) {
    return JSON.stringify({ path, status: 'available' });
  }
  if (path.endsWith('.md')) {
    return '# Run Artifact';
  }
  if (path.endsWith('.html')) {
    return '<html><head><title>Artifact</title></head><body>available</body></html>';
  }

  return `artifact: ${path}`;
}

async function readArtifactWithFallback(path: string, runId: string): Promise<string> {
  const fullPath = join(DEFAULT_ARTIFACT_ROOT, runId, path);

  try {
    return await readFile(fullPath, 'utf8');
  } catch {
    return fallbackArtifactContent(path);
  }
}

function compareByIsoThenId(left: { startedAt: string; id: string }, right: { startedAt: string; id: string }): number {
  const leftTime = Date.parse(left.startedAt);
  const rightTime = Date.parse(right.startedAt);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return right.id.localeCompare(left.id);
}

export class InMemoryRunQueryService implements RunQueryService {
  private readonly runs = new Map<string, RunRecord>();
  private readonly phasesByRun = new Map<string, Omit<PhaseRecord, 'sequence'>[]>();
  private readonly logsByRun = new Map<string, LogEntry[]>();
  private readonly artifactsByRun = new Map<string, ArtifactPayload>();

  constructor(seed: SeedRun[] = []) {
    for (const entry of seed) {
      this.runs.set(entry.run.id, { ...entry.run });
      this.phasesByRun.set(entry.run.id, [...(entry.phases ?? [])]);
      this.logsByRun.set(entry.run.id, [...(entry.logs ?? [])]);
      if (entry.artifacts) {
        this.artifactsByRun.set(entry.run.id, {
          runId: entry.artifacts.runId,
          paths: [...entry.artifacts.paths],
          contents: { ...entry.artifacts.contents }
        });
      }
    }
  }

  async listRuns(): Promise<RunRecord[]> {
    return [...this.runs.values()].sort(compareByIsoThenId).map((run) => ({ ...run }));
  }

  async loadRun(runId: string): Promise<RunRecord | undefined> {
    const run = this.runs.get(runId);
    return run ? { ...run } : undefined;
  }

  async loadRunPhases(runId: string): Promise<PhaseRecord[]> {
    return (this.phasesByRun.get(runId) ?? []).map((phase, index) => ({ ...phase, sequence: index + 1 }));
  }

  async loadRunLogs(runId: string): Promise<LogEntry[]> {
    return (this.logsByRun.get(runId) ?? []).map((entry) => ({ ...entry }));
  }

  async loadRunLogsAfter(runId: string, afterSequence: number): Promise<LogEntry[]> {
    const entries = this.logsByRun.get(runId) ?? [];
    return entries.filter((entry) => entry.sequence > afterSequence).map((entry) => ({ ...entry }));
  }

  async loadRunArtifacts(runId: string): Promise<ArtifactPayload | undefined> {
    const payload = this.artifactsByRun.get(runId);
    if (!payload) {
      return undefined;
    }

    return {
      runId: payload.runId,
      paths: [...payload.paths],
      contents: { ...payload.contents }
    };
  }
}

export class PrismaRunQueryService implements RunQueryService {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async listRuns(): Promise<RunRecord[]> {
    const records = await this.prisma.run.findMany({
      include: {
        project: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    return records.map((run) => ({
      id: run.id,
      projectId: run.project.name,
      status: mapRunStatus(run.status),
      startedAt: normalizeIso(run.startedAt ?? run.createdAt)
    }));
  }

  async loadRun(runId: string): Promise<RunRecord | undefined> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    });
    if (!run) {
      return undefined;
    }

    return {
      id: run.id,
      projectId: run.project.name,
      status: mapRunStatus(run.status),
      startedAt: normalizeIso(run.startedAt ?? run.createdAt)
    };
  }

  async loadRunPhases(runId: string): Promise<PhaseRecord[]> {
    const phases = await this.prisma.phase.findMany({
      where: { runId },
      orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });

    return phases.map((phase, index) => ({
      id: phase.id,
      runId: phase.runId,
      name: phase.name,
      status: mapPhaseStatus(phase.status),
      sequence: index + 1
    }));
  }

  async loadRunLogs(runId: string): Promise<LogEntry[]> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        phases: {
          orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
        }
      }
    });
    if (!run) {
      return [];
    }

    const entries: LogEntry[] = [];
    const runStart = normalizeIso(run.startedAt ?? run.createdAt);
    entries.push({
      runId,
      sequence: 1,
      timestamp: runStart,
      message: 'run started',
      level: 'info'
    });

    for (const phase of run.phases) {
      const status = mapPhaseStatus(phase.status);
      const level: LogLevel = status === 'failed' ? 'error' : status === 'running' ? 'warn' : 'info';
      entries.push({
        runId,
        sequence: entries.length + 1,
        timestamp: normalizeIso(phase.startedAt ?? phase.createdAt),
        message: `phase ${phase.name.toLowerCase()} ${status}`,
        level
      });
    }

    if (run.status === 'completed') {
      entries.push({
        runId,
        sequence: entries.length + 1,
        timestamp: normalizeIso(run.completedAt ?? run.updatedAt),
        message: 'run completed',
        level: 'info'
      });
    }

    if (run.status === 'failed') {
      entries.push({
        runId,
        sequence: entries.length + 1,
        timestamp: normalizeIso(run.updatedAt),
        message: run.errorMessage?.trim() || 'run failed',
        level: 'error'
      });
    }

    return entries;
  }

  async loadRunLogsAfter(runId: string, afterSequence: number): Promise<LogEntry[]> {
    const entries = await this.loadRunLogs(runId);
    return entries.filter((entry) => entry.sequence > afterSequence);
  }

  async loadRunArtifacts(runId: string): Promise<ArtifactPayload | undefined> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      select: { id: true }
    });
    if (!run) {
      return undefined;
    }

    const artifacts = await this.prisma.artifact.findMany({
      where: { runId },
      orderBy: [{ createdAt: 'asc' }, { path: 'asc' }]
    });
    if (artifacts.length === 0) {
      return undefined;
    }

    const paths = artifacts.map((artifact) => artifact.path);
    const contents = Object.fromEntries(
      await Promise.all(
        paths.map(async (path) => [path, await readArtifactWithFallback(path, runId)] as const)
      )
    );

    return {
      runId,
      paths,
      contents
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
