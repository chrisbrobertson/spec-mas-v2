import { describe, expect, it } from 'vitest';
import { runIntegrationMatrix } from '../src/matrix.js';
import { GitWorkspaceManager } from '../../runtime/src/gitWorkspace.js';
import { applyMergeApprovalAction } from '../../workflow/src/gates.js';

describe('integration matrix suite', () => {
  it('passes when all matrix scenarios pass', async () => {
    const result = await runIntegrationMatrix([
      { id: 'api-cli', components: ['api', 'cli'], run: async () => true },
      { id: 'runtime-github', components: ['runtime', 'github'], run: async () => true }
    ]);

    expect(result.pass).toBe(true);
    expect(result.scenarios.map((scenario) => scenario.id)).toEqual(['api-cli', 'runtime-github']);
  });

  it('fails when any scenario fails', async () => {
    const result = await runIntegrationMatrix([
      { id: 'api-cli', components: ['api', 'cli'], run: async () => true },
      { id: 'runtime-github', components: ['runtime', 'github'], run: async () => false }
    ]);

    expect(result.pass).toBe(false);
    expect(result.scenarios.find((scenario) => !scenario.pass)?.id).toBe('runtime-github');
  });

  it('covers project/branch/approval integration behavior', async () => {
    const result = await runIntegrationMatrix([
      {
        id: 'project-branch-allocation',
        components: ['api', 'runtime'],
        run: async () => {
          const manager = new GitWorkspaceManager();
          const branch = manager.allocateTaskBranch('run-900', 'issue-1');
          return (
            branch === 'specmas/run-900/issue-1' &&
            manager.integrationBranchName('run-900') === 'specmas/run-900/integration'
          );
        }
      },
      {
        id: 'human-approval-merge',
        components: ['api', 'workflow'],
        run: async () => {
          const approved = applyMergeApprovalAction(
            {
              runId: 'run-900',
              status: 'awaiting_human_approval',
              updatedAt: '2026-02-21T00:00:00.000Z'
            },
            'approve'
          );
          const merged = applyMergeApprovalAction(approved, 'merge');
          return merged.status === 'merged';
        }
      }
    ]);

    expect(result.pass).toBe(true);
    expect(result.scenarios.map((scenario) => scenario.id).sort()).toEqual([
      'human-approval-merge',
      'project-branch-allocation'
    ]);
  });
});
