function sanitizeBranchComponent(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!sanitized) {
    throw new Error('Branch component cannot be empty');
  }

  return sanitized;
}

export function taskBranchName(runId: string, taskId: string): string {
  return `specmas/${sanitizeBranchComponent(runId)}/${sanitizeBranchComponent(taskId)}`;
}

export class GitWorkspaceManager {
  private readonly branchOwners = new Map<string, string>();
  private readonly taskAssignments = new Map<string, string>();

  allocateTaskBranch(runId: string, taskId: string): string {
    const assignmentKey = `${runId}::${taskId}`;
    const existing = this.taskAssignments.get(assignmentKey);
    if (existing) {
      return existing;
    }

    const branch = taskBranchName(runId, taskId);
    const ownerRunId = this.branchOwners.get(branch);
    if (ownerRunId && ownerRunId !== runId) {
      throw new Error(`Branch reuse denied: ${branch} already allocated to run ${ownerRunId}`);
    }

    this.branchOwners.set(branch, runId);
    this.taskAssignments.set(assignmentKey, branch);
    return branch;
  }

  integrationBranchName(runId: string): string {
    return `specmas/${sanitizeBranchComponent(runId)}/integration`;
  }

  releaseBranchName(runId: string): string {
    return `specmas/${sanitizeBranchComponent(runId)}/release`;
  }

  createBranchCommands(runId: string, taskId: string, baseBranch = 'main'): string[][] {
    const branch = this.allocateTaskBranch(runId, taskId);
    return [
      ['git', 'fetch', '--all', '--prune'],
      ['git', 'checkout', baseBranch],
      ['git', 'checkout', '-B', branch],
      ['git', 'branch', '--show-current']
    ];
  }

  checkpointCommitCommands(message: string): string[][] {
    if (!message.trim()) {
      throw new Error('Commit message is required');
    }

    return [
      ['git', 'add', '-A'],
      ['git', 'commit', '-m', message]
    ];
  }

  cleanupBranchCommands(branchName: string, returnBranch = 'main'): string[][] {
    this.branchOwners.delete(branchName);
    for (const [taskKey, value] of this.taskAssignments.entries()) {
      if (value === branchName) {
        this.taskAssignments.delete(taskKey);
      }
    }

    return [
      ['git', 'checkout', returnBranch],
      ['git', 'branch', '-D', branchName]
    ];
  }
}
