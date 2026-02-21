export enum RunStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Paused = 'paused',
  Cancelled = 'cancelled'
}

export enum PhaseStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
  Cancelled = 'cancelled'
}

export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Blocked = 'blocked',
  Cancelled = 'cancelled'
}

export enum ArtifactType {
  Json = 'json',
  Markdown = 'md',
  Sarif = 'sarif',
  Patch = 'patch',
  Html = 'html',
  Jsonl = 'jsonl',
  Xml = 'xml',
  Text = 'text',
  Log = 'log'
}

export interface ProjectRecord {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch: string;
  configYaml?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  id: string;
  name: string;
  repoUrl: string;
  defaultBranch?: string;
  configYaml?: string;
}

export interface UpdateProjectInput {
  name?: string;
  repoUrl?: string;
  defaultBranch?: string;
  configYaml?: string;
}

export interface RunRecord {
  id: string;
  projectId: string;
  specId?: string;
  workflowId?: string;
  status: RunStatus;
  currentPhase?: string;
  startedAt?: Date;
  completedAt?: Date;
  initiatedBy?: string;
  errorMessage?: string;
  artifactPath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRunInput {
  id: string;
  projectId: string;
  specId?: string;
  workflowId?: string;
  status?: RunStatus;
  initiatedBy?: string;
}

export interface PhaseRecord {
  id: string;
  runId: string;
  name: string;
  status: PhaseStatus;
  agentId?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePhaseInput {
  id: string;
  runId: string;
  name: string;
  status?: PhaseStatus;
  agentId?: string;
}

export interface TaskRecord {
  id: string;
  runId: string;
  phaseId: string;
  status: TaskStatus;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  specSection?: string;
  agentId?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  restartCount: number;
  branchName?: string;
  resultJson?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  id: string;
  runId: string;
  phaseId: string;
  status?: TaskStatus;
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  specSection?: string;
  agentId?: string;
  branchName?: string;
}

export interface ArtifactRecord {
  id: string;
  runId?: string;
  phaseId?: string;
  taskId?: string;
  path: string;
  type: ArtifactType;
  sizeBytes?: number;
  createdAt: Date;
}
