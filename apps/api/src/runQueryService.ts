import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, type PhaseStatus as PrismaPhaseStatus, type RunStatus as PrismaRunStatus } from '@prisma/client';

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
export type PhaseStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type LogLevel = 'info' | 'warn' | 'error';
export type MergeStatus = 'awaiting_human_approval' | 'approved' | 'rejected' | 'merged';

export interface RunRecord {
  id: string;
  projectId: string;
  status: RunStatus;
  startedAt: string;
  sourceBranch: string;
  workingBranch: string;
  integrationBranch: string;
  releaseBranch: string;
  mergeStatus: MergeStatus;
}

export interface ProjectRecord {
  projectId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  activeRunCount: number;
}

export interface ProjectBranchInventory {
  projectId: string;
  defaultBranch: string;
  integrationBranches: string[];
  releaseBranches: string[];
  activeRunBranches: string[];
}

export interface RunQueryFilter {
  projectId?: string;
  branch?: string;
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
  listRuns(filter?: RunQueryFilter): Promise<RunRecord[]>;
  loadRun(runId: string): Promise<RunRecord | undefined>;
  loadRunPhases(runId: string): Promise<PhaseRecord[]>;
  loadRunLogs(runId: string): Promise<LogEntry[]>;
  loadRunLogsAfter(runId: string, afterSequence: number): Promise<LogEntry[]>;
  loadRunArtifacts(runId: string): Promise<ArtifactPayload | undefined>;
  listProjects(): Promise<ProjectRecord[]>;
  loadProject(projectId: string): Promise<ProjectRecord | undefined>;
  loadProjectBranches(projectId: string): Promise<ProjectBranchInventory | undefined>;
  close?(): Promise<void>;
}

interface SeedProject {
  projectId: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
}

interface SeedRun {
  run: RunRecord;
  phases?: Omit<PhaseRecord, 'sequence'>[];
  logs?: LogEntry[];
  artifacts?: ArtifactPayload;
}

const REPO_ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const DEFAULT_ARTIFACT_ROOT = resolve(REPO_ROOT, 'artifacts', 'runs');

function sanitizeBranchComponent(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function defaultWorkingBranch(runId: string): string {
  return `specmas/${sanitizeBranchComponent(runId)}/task-default`;
}

function defaultIntegrationBranch(runId: string): string {
  return `specmas/${sanitizeBranchComponent(runId)}/integration`;
}

function defaultReleaseBranch(runId: string): string {
  return `specmas/${sanitizeBranchComponent(runId)}/release`;
}

function defaultMergeStatus(runStatus: RunStatus): MergeStatus {
  switch (runStatus) {
    case 'failed':
    case 'cancelled':
      return 'rejected';
    case 'passed':
    case 'running':
    case 'queued':
      return 'awaiting_human_approval';
  }
}

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
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly runs = new Map<string, RunRecord>();
  private readonly phasesByRun = new Map<string, Omit<PhaseRecord, 'sequence'>[]>();
  private readonly logsByRun = new Map<string, LogEntry[]>();
  private readonly artifactsByRun = new Map<string, ArtifactPayload>();

  constructor(seed: SeedRun[] = [], seedProjects: SeedProject[] = []) {
    for (const project of seedProjects) {
      this.projects.set(project.projectId, {
        projectId: project.projectId,
        name: project.name,
        repoUrl: project.repoUrl,
        defaultBranch: project.defaultBranch,
        activeRunCount: 0
      });
    }

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

      if (!this.projects.has(entry.run.projectId)) {
        this.projects.set(entry.run.projectId, {
          projectId: entry.run.projectId,
          name: entry.run.projectId,
          repoUrl: `https://github.com/specmas/${entry.run.projectId}`,
          defaultBranch: entry.run.sourceBranch,
          activeRunCount: 0
        });
      }
    }
  }

  async listRuns(filter?: RunQueryFilter): Promise<RunRecord[]> {
    return [...this.runs.values()]
      .filter((run) => {
        if (filter?.projectId && run.projectId !== filter.projectId) {
          return false;
        }
        if (filter?.branch) {
          return (
            run.sourceBranch === filter.branch ||
            run.workingBranch === filter.branch ||
            run.integrationBranch === filter.branch ||
            run.releaseBranch === filter.branch
          );
        }
        return true;
      })
      .sort(compareByIsoThenId)
      .map((run) => ({ ...run }));
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

  async listProjects(): Promise<ProjectRecord[]> {
    const activeByProject = new Map<string, number>();
    for (const run of this.runs.values()) {
      if (run.status === 'running' || run.status === 'queued') {
        activeByProject.set(run.projectId, (activeByProject.get(run.projectId) ?? 0) + 1);
      }
    }

    return [...this.projects.values()]
      .map((project) => ({
        ...project,
        activeRunCount: activeByProject.get(project.projectId) ?? 0
      }))
      .sort((left, right) => left.projectId.localeCompare(right.projectId));
  }

  async loadProject(projectId: string): Promise<ProjectRecord | undefined> {
    const projects = await this.listProjects();
    return projects.find((project) => project.projectId === projectId);
  }

  async loadProjectBranches(projectId: string): Promise<ProjectBranchInventory | undefined> {
    const project = this.projects.get(projectId);
    if (!project) {
      return undefined;
    }

    const runs = [...this.runs.values()].filter((run) => run.projectId === projectId);
    const integrationBranches = [...new Set(runs.map((run) => run.integrationBranch))].sort();
    const releaseBranches = [...new Set(runs.map((run) => run.releaseBranch))].sort();
    const activeRunBranches = [...new Set(runs.map((run) => run.workingBranch))].sort();

    return {
      projectId,
      defaultBranch: project.defaultBranch,
      integrationBranches,
      releaseBranches,
      activeRunBranches
    };
  }
}

export class PrismaRunQueryService implements RunQueryService {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async listRuns(filter?: RunQueryFilter): Promise<RunRecord[]> {
    const records = await this.prisma.run.findMany({
      where: filter?.projectId
        ? {
            project: {
              name: filter.projectId
            }
          }
        : undefined,
      include: {
        project: {
          select: {
            name: true,
            defaultBranch: true
          }
        },
        tasks: {
          select: {
            branchName: true
          }
        }
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    });

    const mapped = records.map((run) => {
      const status = mapRunStatus(run.status);
      const workingBranch =
        run.tasks.find((task) => typeof task.branchName === 'string' && task.branchName.trim().length > 0)?.branchName ??
        defaultWorkingBranch(run.id);
      const integrationBranch = defaultIntegrationBranch(run.id);
      const releaseBranch = defaultReleaseBranch(run.id);

      return {
        id: run.id,
        projectId: run.project.name,
        status,
        startedAt: normalizeIso(run.startedAt ?? run.createdAt),
        sourceBranch: run.project.defaultBranch,
        workingBranch,
        integrationBranch,
        releaseBranch,
        mergeStatus: defaultMergeStatus(status)
      } satisfies RunRecord;
    });

    if (!filter?.branch) {
      return mapped;
    }

    return mapped.filter((run) => {
      const branch = filter.branch as string;
      return (
        run.sourceBranch === branch ||
        run.workingBranch === branch ||
        run.integrationBranch === branch ||
        run.releaseBranch === branch
      );
    });
  }

  async loadRun(runId: string): Promise<RunRecord | undefined> {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: {
        project: {
          select: {
            name: true,
            defaultBranch: true
          }
        },
        tasks: {
          select: {
            branchName: true
          }
        }
      }
    });
    if (!run) {
      return undefined;
    }

    const status = mapRunStatus(run.status);
    const workingBranch =
      run.tasks.find((task) => typeof task.branchName === 'string' && task.branchName.trim().length > 0)?.branchName ??
      defaultWorkingBranch(run.id);
    return {
      id: run.id,
      projectId: run.project.name,
      status,
      startedAt: normalizeIso(run.startedAt ?? run.createdAt),
      sourceBranch: run.project.defaultBranch,
      workingBranch,
      integrationBranch: defaultIntegrationBranch(run.id),
      releaseBranch: defaultReleaseBranch(run.id),
      mergeStatus: defaultMergeStatus(status)
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

  async listProjects(): Promise<ProjectRecord[]> {
    const projects = await this.prisma.project.findMany({
      include: {
        runs: {
          select: {
            status: true
          }
        }
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }]
    });

    return projects.map((project) => ({
      projectId: project.name,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      activeRunCount: project.runs.filter((run) => run.status === 'running' || run.status === 'pending').length
    }));
  }

  async loadProject(projectId: string): Promise<ProjectRecord | undefined> {
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ name: projectId }, { id: projectId }]
      },
      include: {
        runs: {
          select: {
            status: true
          }
        }
      }
    });
    if (!project) {
      return undefined;
    }

    return {
      projectId: project.name,
      name: project.name,
      repoUrl: project.repoUrl,
      defaultBranch: project.defaultBranch,
      activeRunCount: project.runs.filter((run) => run.status === 'running' || run.status === 'pending').length
    };
  }

  async loadProjectBranches(projectId: string): Promise<ProjectBranchInventory | undefined> {
    const project = await this.prisma.project.findFirst({
      where: {
        OR: [{ name: projectId }, { id: projectId }]
      },
      include: {
        runs: {
          include: {
            tasks: {
              select: {
                branchName: true
              }
            }
          }
        }
      }
    });
    if (!project) {
      return undefined;
    }

    const integrationBranches = [...new Set(project.runs.map((run) => defaultIntegrationBranch(run.id)))].sort();
    const releaseBranches = [...new Set(project.runs.map((run) => defaultReleaseBranch(run.id)))].sort();
    const activeRunBranches = [
      ...new Set(
        project.runs.map((run) => {
          const branch = run.tasks.find((task) => task.branchName && task.branchName.trim().length > 0)?.branchName;
          return branch ?? defaultWorkingBranch(run.id);
        })
      )
    ].sort();

    return {
      projectId: project.name,
      defaultBranch: project.defaultBranch,
      integrationBranches,
      releaseBranches,
      activeRunBranches
    };
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
