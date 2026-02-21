export interface CriticalPathSnapshot {
  specId: string;
  issueIds: string[];
  runId: string;
  artifactIds: string[];
}

export function serializeCriticalPath(snapshot: CriticalPathSnapshot): string {
  return JSON.stringify(
    {
      specId: snapshot.specId,
      issueIds: [...snapshot.issueIds].sort(),
      runId: snapshot.runId,
      artifactIds: [...snapshot.artifactIds].sort()
    },
    null,
    2
  );
}

export function compareCriticalPathSnapshots(
  expected: CriticalPathSnapshot,
  actual: CriticalPathSnapshot
): { pass: boolean; diff: string[] } {
  const diff: string[] = [];
  const expectedJson = serializeCriticalPath(expected);
  const actualJson = serializeCriticalPath(actual);

  if (expectedJson !== actualJson) {
    diff.push('critical-path snapshot mismatch');
  }

  return {
    pass: diff.length === 0,
    diff
  };
}
