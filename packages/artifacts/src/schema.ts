export type ArtifactKind = 'log' | 'report' | 'json' | 'diff' | 'html' | 'sarif';

export interface ArtifactManifest {
  artifactId: string;
  runId: string;
  phaseId: string;
  taskId: string;
  kind: ArtifactKind;
  path: string;
  createdAt: string;
  checksum: string;
  sizeBytes: number;
}

export interface SchemaValidationResult {
  ok: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateArtifactManifest(manifest: unknown): SchemaValidationResult {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['Manifest must be an object'] };
  }

  const record = manifest as Record<string, unknown>;
  const requiredKeys: Array<keyof ArtifactManifest> = [
    'artifactId',
    'runId',
    'phaseId',
    'taskId',
    'kind',
    'path',
    'createdAt',
    'checksum',
    'sizeBytes'
  ];

  requiredKeys.forEach((key) => {
    if (record[key] === undefined) {
      errors.push(`Missing field "${key}"`);
    }
  });

  if (!isNonEmptyString(record.artifactId)) {
    errors.push('artifactId must be a non-empty string');
  }
  if (!isNonEmptyString(record.runId)) {
    errors.push('runId must be a non-empty string');
  }
  if (!isNonEmptyString(record.phaseId)) {
    errors.push('phaseId must be a non-empty string');
  }
  if (!isNonEmptyString(record.taskId)) {
    errors.push('taskId must be a non-empty string');
  }
  if (!isNonEmptyString(record.path)) {
    errors.push('path must be a non-empty string');
  } else if (record.path.includes('..')) {
    errors.push('path cannot include traversal segments');
  }

  const validKinds: ArtifactKind[] = ['log', 'report', 'json', 'diff', 'html', 'sarif'];
  if (!validKinds.includes(record.kind as ArtifactKind)) {
    errors.push(`kind must be one of: ${validKinds.join(', ')}`);
  }

  if (!isNonEmptyString(record.createdAt) || Number.isNaN(Date.parse(record.createdAt))) {
    errors.push('createdAt must be an ISO timestamp');
  }

  if (!isNonEmptyString(record.checksum)) {
    errors.push('checksum must be a non-empty string');
  }

  if (typeof record.sizeBytes !== 'number' || record.sizeBytes < 0) {
    errors.push('sizeBytes must be a non-negative number');
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
