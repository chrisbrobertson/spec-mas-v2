export function runsEmptyStateMessage(runCount: number): string | undefined {
  return runCount === 0 ? 'No runs yet.' : undefined;
}

export function runDetailEmptyStateMessage(phaseCount: number): string | undefined {
  return phaseCount === 0 ? 'No phases reported yet.' : undefined;
}

export function artifactsEmptyStateMessage(artifactCount: number): string | undefined {
  return artifactCount === 0 ? 'No artifacts available for this run.' : undefined;
}

export function logsEmptyStateMessage(logCount: number): string | undefined {
  return logCount === 0 ? 'No log entries yet.' : undefined;
}
