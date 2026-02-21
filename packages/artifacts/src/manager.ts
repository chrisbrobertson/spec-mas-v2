import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArtifactKind, ArtifactManifest } from './schema.js';
import { validateArtifactManifest } from './schema.js';

export interface WriteArtifactInput {
  artifactId: string;
  runId: string;
  phaseId: string;
  taskId: string;
  kind: ArtifactKind;
  content: string;
  createdAt?: string;
}

function safeSegment(segment: string, label: string): string {
  const value = segment.trim();
  if (!value) {
    throw new Error(`${label} is required`);
  }
  if (value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error(`${label} contains unsupported path characters`);
  }
  return value;
}

function extensionForKind(kind: ArtifactKind): string {
  switch (kind) {
    case 'log':
      return 'log';
    case 'report':
      return 'md';
    case 'json':
      return 'json';
    case 'diff':
      return 'diff';
    case 'html':
      return 'html';
    case 'sarif':
      return 'sarif';
  }
  const unexpectedKind: never = kind;
  throw new Error(`Unsupported artifact kind: ${unexpectedKind}`);
}

function checksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export class FileSystemArtifactManager {
  constructor(private readonly rootDir: string) {}

  private relativePath(input: WriteArtifactInput): string {
    const runId = safeSegment(input.runId, 'runId');
    const phaseId = safeSegment(input.phaseId, 'phaseId');
    const taskId = safeSegment(input.taskId, 'taskId');
    const artifactId = safeSegment(input.artifactId, 'artifactId');
    return join(runId, phaseId, taskId, `${artifactId}.${extensionForKind(input.kind)}`);
  }

  async writeArtifact(input: WriteArtifactInput): Promise<ArtifactManifest> {
    const relPath = this.relativePath(input);
    const fullPath = join(this.rootDir, relPath);
    await mkdir(join(this.rootDir, input.runId, input.phaseId, input.taskId), { recursive: true });
    await writeFile(fullPath, input.content, 'utf8');

    const manifest: ArtifactManifest = {
      artifactId: input.artifactId,
      runId: input.runId,
      phaseId: input.phaseId,
      taskId: input.taskId,
      kind: input.kind,
      path: relPath.replaceAll('\\', '/'),
      createdAt: input.createdAt ?? new Date().toISOString(),
      checksum: checksum(input.content),
      sizeBytes: Buffer.byteLength(input.content, 'utf8')
    };

    const validation = validateArtifactManifest(manifest);
    if (!validation.ok) {
      throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
    }

    return manifest;
  }

  async readArtifact(path: string): Promise<string> {
    if (!path || path.includes('..')) {
      throw new Error('Artifact path is invalid');
    }

    return readFile(join(this.rootDir, path), 'utf8');
  }

  async listTaskArtifacts(runId: string, phaseId: string, taskId: string): Promise<string[]> {
    const safeRunId = safeSegment(runId, 'runId');
    const safePhaseId = safeSegment(phaseId, 'phaseId');
    const safeTaskId = safeSegment(taskId, 'taskId');
    const taskDir = join(this.rootDir, safeRunId, safePhaseId, safeTaskId);

    const entries = await readdir(taskDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(safeRunId, safePhaseId, safeTaskId, entry.name).replaceAll('\\', '/'))
      .sort();
  }
}
