import { describe, expect, it } from 'vitest';
import { InMemoryRunQueryService, parseTaskExecutionResult } from '../src/runQueryService.js';

describe('run-query-service', () => {
  function createService() {
    return new InMemoryRunQueryService([
      {
        run: {
          id: 'run-1',
          projectId: 'alpha',
          status: 'passed',
          startedAt: '2026-02-19T00:00:00.000Z',
          sourceBranch: 'main',
          workingBranch: 'specmas/run-1/issue-101',
          integrationBranch: 'specmas/run-1/integration',
          releaseBranch: 'specmas/run-1/release',
          mergeStatus: 'awaiting_human_approval'
        },
        phases: [
          {
            id: 'phase-1',
            runId: 'run-1',
            name: 'Implement',
            status: 'passed'
          }
        ],
        logs: [
          {
            runId: 'run-1',
            sequence: 1,
            timestamp: '2026-02-19T00:00:01.000Z',
            message: 'run started',
            level: 'info'
          },
          {
            runId: 'run-1',
            sequence: 2,
            timestamp: '2026-02-19T00:00:02.000Z',
            message: 'run completed',
            level: 'info'
          }
        ],
        artifacts: {
          runId: 'run-1',
          paths: ['run-summary.md'],
          contents: {
            'run-summary.md': '# Run Summary'
          }
        }
      },
      {
        run: {
          id: 'run-2',
          projectId: 'alpha',
          status: 'running',
          startedAt: '2026-02-20T00:00:00.000Z',
          sourceBranch: 'main',
          workingBranch: 'specmas/run-2/issue-201',
          integrationBranch: 'specmas/run-2/integration',
          releaseBranch: 'specmas/run-2/release',
          mergeStatus: 'awaiting_human_approval'
        },
        logs: [
          {
            runId: 'run-2',
            sequence: 1,
            timestamp: '2026-02-20T00:00:01.000Z',
            message: 'run started',
            level: 'info'
          }
        ]
      }
    ]);
  }

  it('returns runs sorted by startedAt descending on happy path', async () => {
    const service = createService();
    const runs = await service.listRuns();
    expect(runs.map((run) => run.id)).toEqual(['run-2', 'run-1']);
  });

  it('returns undefined for unknown run and empty edges for unknown collections', async () => {
    const service = createService();
    expect(await service.loadRun('run-404')).toBeUndefined();
    expect(await service.loadRunPhases('run-404')).toEqual([]);
    expect(await service.loadRunLogs('run-404')).toEqual([]);
    expect(await service.loadRunLogsAfter('run-404', 10)).toEqual([]);
    expect(await service.loadRunArtifacts('run-404')).toBeUndefined();
  });

  it('filters logs by after-sequence and protects internal state from mutation', async () => {
    const service = createService();
    const afterOne = await service.loadRunLogsAfter('run-1', 1);
    expect(afterOne.map((entry) => entry.sequence)).toEqual([2]);

    const artifacts = await service.loadRunArtifacts('run-1');
    expect(artifacts).toBeDefined();
    if (!artifacts) {
      throw new Error('expected artifacts');
    }
    artifacts.paths.push('unexpected.txt');
    artifacts.contents['run-summary.md'] = 'mutated';

    const reloaded = await service.loadRunArtifacts('run-1');
    expect(reloaded?.paths).toEqual(['run-summary.md']);
    expect(reloaded?.contents['run-summary.md']).toBe('# Run Summary');
  });

  it('lists projects and branch inventory deterministically', async () => {
    const service = createService();

    const projects = await service.listProjects();
    expect(projects).toEqual([
      {
        projectId: 'alpha',
        name: 'alpha',
        repoUrl: 'https://github.com/specmas/alpha',
        defaultBranch: 'main',
        activeRunCount: 1
      }
    ]);

    const branches = await service.loadProjectBranches('alpha');
    expect(branches).toEqual({
      projectId: 'alpha',
      defaultBranch: 'main',
      integrationBranches: ['specmas/run-1/integration', 'specmas/run-2/integration'],
      releaseBranches: ['specmas/run-1/release', 'specmas/run-2/release'],
      activeRunBranches: ['specmas/run-1/issue-101', 'specmas/run-2/issue-201']
    });
  });

  it('parses persisted task execution payloads on happy and edge paths', () => {
    const parsed = parseTaskExecutionResult(
      JSON.stringify({
        logs: ['log-1', 'log-2'],
        stdout: 'line-a\nline-b\n',
        stderr: 'warn-a\n'
      })
    );
    expect(parsed).toEqual({
      logs: ['log-1', 'log-2'],
      stdoutLines: ['line-a', 'line-b'],
      stderrLines: ['warn-a']
    });

    expect(parseTaskExecutionResult(JSON.stringify({ logs: ['ok', 42] }))).toEqual({
      logs: [],
      stdoutLines: [],
      stderrLines: []
    });
    expect(parseTaskExecutionResult('{bad json')).toEqual({
      logs: [],
      stdoutLines: [],
      stderrLines: []
    });
  });
});
