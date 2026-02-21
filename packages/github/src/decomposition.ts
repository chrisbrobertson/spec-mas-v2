export interface FunctionalRequirement {
  id: string;
  title: string;
  description: string;
  dependsOn?: string[];
  acceptanceCriteria: string[];
}

export interface GitHubIssuePayload {
  title: string;
  body: string;
  labels: string[];
  dependencies: string[];
}

function normalizeDependencies(requirement: FunctionalRequirement): string[] {
  return [...new Set(requirement.dependsOn ?? [])].sort();
}

export function toIssuePayload(requirement: FunctionalRequirement): GitHubIssuePayload {
  if (!requirement.id.trim()) {
    throw new Error('Requirement id is required');
  }
  if (!requirement.title.trim()) {
    throw new Error(`Requirement ${requirement.id} title is required`);
  }
  if (requirement.acceptanceCriteria.length === 0) {
    throw new Error(`Requirement ${requirement.id} must include acceptance criteria`);
  }

  const dependencies = normalizeDependencies(requirement);
  const checklist = requirement.acceptanceCriteria.map((criteria) => `- [ ] ${criteria}`).join('\n');
  const dependencyLine =
    dependencies.length > 0 ? dependencies.map((dependency) => `#${dependency}`).join(', ') : 'none';

  return {
    title: `[${requirement.id}] ${requirement.title}`,
    labels: ['specmas', 'fr', `fr:${requirement.id.toLowerCase()}`],
    dependencies,
    body: [
      `## Functional Requirement`,
      requirement.description,
      '',
      `## Dependencies`,
      dependencyLine,
      '',
      `## Acceptance Criteria`,
      checklist
    ].join('\n')
  };
}

export function decomposeRequirements(requirements: readonly FunctionalRequirement[]): GitHubIssuePayload[] {
  return requirements.map((requirement) => toIssuePayload(requirement));
}
