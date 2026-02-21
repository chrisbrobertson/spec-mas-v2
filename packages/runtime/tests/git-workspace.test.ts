import { describe, expect, it } from 'vitest';
import { GitWorkspaceManager, taskBranchName } from '../src/gitWorkspace.js';

describe('git workspace manager', () => {
  it('builds deterministic branch names', () => {
    expect(taskBranchName('run-1', 'task/a')).toBe('specmas/run-1/task-a');
  });

  it('returns branch commands', () => {
    const manager = new GitWorkspaceManager();
    const commands = manager.createBranchCommands('run-1', 'task-1');

    expect(commands).toEqual([
      ['git', 'fetch', '--all', '--prune'],
      ['git', 'checkout', 'main'],
      ['git', 'checkout', '-B', 'specmas/run-1/task-1'],
      ['git', 'branch', '--show-current']
    ]);
  });

  it('rejects blank commit message', () => {
    const manager = new GitWorkspaceManager();
    expect(() => manager.checkpointCommitCommands('')).toThrow('Commit message is required');
  });

  it('creates cleanup commands', () => {
    const manager = new GitWorkspaceManager();
    expect(manager.cleanupBranchCommands('specmas/run-1/task-1')).toEqual([
      ['git', 'checkout', 'main'],
      ['git', 'branch', '-D', 'specmas/run-1/task-1']
    ]);
  });

  it('rejects branch reuse across different runs', () => {
    const manager = new GitWorkspaceManager();
    manager.allocateTaskBranch('run a', 'task-a');

    expect(() => manager.allocateTaskBranch('run-a', 'task-a')).toThrow(
      'Branch reuse denied: specmas/run-a/task-a already allocated to run run a'
    );
  });

  it('builds integration and release branch names', () => {
    const manager = new GitWorkspaceManager();
    expect(manager.integrationBranchName('run-1')).toBe('specmas/run-1/integration');
    expect(manager.releaseBranchName('run-1')).toBe('specmas/run-1/release');
  });
});
