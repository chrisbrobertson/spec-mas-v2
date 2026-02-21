import type { ArtifactManifest } from './schema.js';

export interface RetentionPolicy {
  maxAgeDays: number;
  maxArtifactsPerTask: number;
  dryRun: boolean;
  safeMode: boolean;
}

export interface RetentionDecision {
  keep: ArtifactManifest[];
  delete: ArtifactManifest[];
  reasonByArtifactId: Record<string, string>;
}

function ageDays(createdAt: string, now: Date): number {
  const created = new Date(createdAt);
  const ageMs = now.getTime() - created.getTime();
  return ageMs / (1000 * 60 * 60 * 24);
}

function key(manifest: ArtifactManifest): string {
  return `${manifest.runId}:${manifest.phaseId}:${manifest.taskId}`;
}

export function evaluateRetention(
  manifests: readonly ArtifactManifest[],
  policy: RetentionPolicy,
  now = new Date()
): RetentionDecision {
  if (policy.maxAgeDays < 0 || policy.maxArtifactsPerTask < 1) {
    throw new Error('Retention policy values are invalid');
  }
  if (!policy.safeMode && !policy.dryRun) {
    throw new Error('Retention cleanup requires safeMode when dryRun is disabled');
  }

  const grouped = new Map<string, ArtifactManifest[]>();
  manifests.forEach((manifest) => {
    const groupKey = key(manifest);
    const list = grouped.get(groupKey) ?? [];
    list.push(manifest);
    grouped.set(groupKey, list);
  });

  const keep: ArtifactManifest[] = [];
  const deleteList: ArtifactManifest[] = [];
  const reasonByArtifactId: Record<string, string> = {};

  for (const group of grouped.values()) {
    const ordered = [...group].sort((left, right) => {
      const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
      if (byDate !== 0) {
        return byDate;
      }
      return left.artifactId.localeCompare(right.artifactId);
    });

    ordered.forEach((manifest, index) => {
      const tooOld = ageDays(manifest.createdAt, now) > policy.maxAgeDays;
      const overCount = index >= policy.maxArtifactsPerTask;
      if (tooOld || overCount) {
        deleteList.push(manifest);
        reasonByArtifactId[manifest.artifactId] = tooOld ? 'expired' : 'count-limit';
      } else {
        keep.push(manifest);
      }
    });
  }

  return {
    keep: keep.sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
    delete: deleteList.sort((left, right) => left.artifactId.localeCompare(right.artifactId)),
    reasonByArtifactId
  };
}
