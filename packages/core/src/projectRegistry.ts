import type { CreateProjectInput, ProjectRecord, UpdateProjectInput } from './domain.js';

const DEFAULT_BRANCH = 'main';

export interface ProjectRegistryRepository {
  create(input: CreateProjectInput): ProjectRecord;
  get(id: string): ProjectRecord | undefined;
  getByRepoUrl(repoUrl: string): ProjectRecord | undefined;
  list(): ProjectRecord[];
  update(id: string, patch: UpdateProjectInput): ProjectRecord;
  remove(id: string): boolean;
}

function cloneProject(project: ProjectRecord): ProjectRecord {
  return {
    ...project,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt)
  };
}

function assertNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`Project ${fieldName} must not be empty`);
  }
}

export class InMemoryProjectRegistry implements ProjectRegistryRepository {
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  create(input: CreateProjectInput): ProjectRecord {
    assertNonEmpty(input.name, 'name');
    assertNonEmpty(input.repoUrl, 'repoUrl');
    if (input.defaultBranch !== undefined) {
      assertNonEmpty(input.defaultBranch, 'defaultBranch');
    }

    if (this.projects.has(input.id)) {
      throw new Error(`Project already exists: ${input.id}`);
    }

    const existingRepo = this.getByRepoUrl(input.repoUrl);
    if (existingRepo) {
      throw new Error(`Project repository already registered: ${input.repoUrl}`);
    }

    const timestamp = this.now();
    const project: ProjectRecord = {
      id: input.id,
      name: input.name,
      repoUrl: input.repoUrl,
      defaultBranch: input.defaultBranch ?? DEFAULT_BRANCH,
      configYaml: input.configYaml,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.projects.set(project.id, project);
    return cloneProject(project);
  }

  update(id: string, patch: UpdateProjectInput): ProjectRecord {
    const existing = this.projects.get(id);
    if (!existing) {
      throw new Error(`Project not found: ${id}`);
    }

    if (patch.repoUrl) {
      const other = this.getByRepoUrl(patch.repoUrl);
      if (other && other.id !== id) {
        throw new Error(`Project repository already registered: ${patch.repoUrl}`);
      }
    }
    if (patch.name !== undefined) {
      assertNonEmpty(patch.name, 'name');
    }
    if (patch.repoUrl !== undefined) {
      assertNonEmpty(patch.repoUrl, 'repoUrl');
    }
    if (patch.defaultBranch !== undefined) {
      assertNonEmpty(patch.defaultBranch, 'defaultBranch');
    }

    const updated: ProjectRecord = {
      ...existing,
      ...patch,
      id,
      updatedAt: this.now()
    };

    this.projects.set(id, updated);
    return cloneProject(updated);
  }

  remove(id: string): boolean {
    return this.projects.delete(id);
  }

  get(id: string): ProjectRecord | undefined {
    const project = this.projects.get(id);
    return project ? cloneProject(project) : undefined;
  }

  getByRepoUrl(repoUrl: string): ProjectRecord | undefined {
    for (const project of this.projects.values()) {
      if (project.repoUrl === repoUrl) {
        return cloneProject(project);
      }
    }
    return undefined;
  }

  list(): ProjectRecord[] {
    return Array.from(this.projects.values())
      .map((project) => cloneProject(project))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }
}

export class ProjectRegistry extends InMemoryProjectRegistry {}
