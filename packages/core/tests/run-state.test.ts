import { describe, expect, it } from 'vitest';
import { PhaseStatus, RunStatus, TaskStatus } from '../src/domain.js';
import { InMemoryRunStateRepository } from '../src/runStateRepo.js';

function createDeterministicClock(isoTimestamps: string[]): () => Date {
  let index = 0;
  return () => {
    const value = isoTimestamps[Math.min(index, isoTimestamps.length - 1)];
    index += 1;
    return new Date(value);
  };
}

describe('run state repository', () => {
  it('creates and updates run hierarchy records', () => {
    const repo = new InMemoryRunStateRepository(
      createDeterministicClock([
        '2026-02-19T01:00:00.000Z',
        '2026-02-19T01:00:05.000Z',
        '2026-02-19T01:00:10.000Z',
        '2026-02-19T01:00:15.000Z',
        '2026-02-19T01:00:20.000Z',
        '2026-02-19T01:00:25.000Z',
        '2026-02-19T01:00:30.000Z'
      ])
    );

    repo.createRun({ id: 'r1', projectId: 'p1' });
    repo.createPhase({ id: 'ph1', runId: 'r1', name: 'implement' });
    repo.createTask({ id: 't1', runId: 'r1', phaseId: 'ph1' });

    const run = repo.updateRunStatus('r1', RunStatus.Running);
    const phase = repo.updatePhaseStatus('ph1', PhaseStatus.Running);
    repo.updateTaskStatus('t1', TaskStatus.Running);
    const task = repo.updateTaskStatus('t1', TaskStatus.Completed);

    expect(run.status).toBe(RunStatus.Running);
    expect(run.startedAt?.toISOString()).toBe('2026-02-19T01:00:15.000Z');
    expect(phase.status).toBe(PhaseStatus.Running);
    expect(task.status).toBe(TaskStatus.Completed);
    expect(task.completedAt?.toISOString()).toBe('2026-02-19T01:00:30.000Z');
  });

  it('rejects invalid hierarchy references', () => {
    const repo = new InMemoryRunStateRepository();
    repo.createRun({ id: 'r1', projectId: 'p1' });
    repo.createPhase({ id: 'ph1', runId: 'r1', name: 'implement' });

    expect(() => repo.createPhase({ id: 'ph2', runId: 'missing', name: 'test' })).toThrow(
      'Run not found: missing'
    );
    expect(() => repo.createTask({ id: 't1', runId: 'r1', phaseId: 'missing' })).toThrow(
      'Phase not found: missing'
    );
  });

  it('rejects tasks attached to mismatched run and phase', () => {
    const repo = new InMemoryRunStateRepository();
    repo.createRun({ id: 'run-a', projectId: 'p1' });
    repo.createRun({ id: 'run-b', projectId: 'p1' });
    repo.createPhase({ id: 'phase-a', runId: 'run-a', name: 'implement' });

    expect(() => repo.createTask({ id: 'task-1', runId: 'run-b', phaseId: 'phase-a' })).toThrow(
      'Phase phase-a does not belong to run run-b'
    );
  });

  it('lists records deterministically and returns safe clones', () => {
    const repo = new InMemoryRunStateRepository(
      createDeterministicClock(['2026-02-19T01:30:00.000Z', '2026-02-19T01:30:00.000Z'])
    );
    repo.createRun({ id: 'r2', projectId: 'p1' });
    repo.createRun({ id: 'r1', projectId: 'p1' });

    const runs = repo.listRunsByProject('p1');
    runs[0].status = RunStatus.Failed;

    expect(runs.map((record) => record.id)).toEqual(['r1', 'r2']);
    expect(repo.getRun('r1')?.status).toBe(RunStatus.Pending);
  });

  it('rejects illegal status transitions', () => {
    const repo = new InMemoryRunStateRepository();
    repo.createRun({ id: 'run-1', projectId: 'p1' });
    repo.createPhase({ id: 'phase-1', runId: 'run-1', name: 'implement' });
    repo.createTask({ id: 'task-1', runId: 'run-1', phaseId: 'phase-1' });

    expect(() => repo.updateRunStatus('run-1', RunStatus.Completed)).toThrow(
      'Illegal run transition: pending -> completed'
    );
    expect(() => repo.updatePhaseStatus('phase-1', PhaseStatus.Completed)).toThrow(
      'Illegal phase transition: pending -> completed'
    );
    expect(() => repo.updateTaskStatus('task-1', TaskStatus.Completed)).toThrow(
      'Illegal task transition: pending -> completed'
    );
  });

  it('clears terminal completion timestamps when reset to pending', () => {
    const repo = new InMemoryRunStateRepository(
      createDeterministicClock([
        '2026-02-19T02:00:00.000Z',
        '2026-02-19T02:00:05.000Z',
        '2026-02-19T02:00:10.000Z',
        '2026-02-19T02:00:15.000Z'
      ])
    );

    repo.createRun({ id: 'run-1', projectId: 'p1' });
    repo.updateRunStatus('run-1', RunStatus.Running);
    const failed = repo.updateRunStatus('run-1', RunStatus.Failed);
    expect(failed.completedAt?.toISOString()).toBe('2026-02-19T02:00:10.000Z');

    const reset = repo.updateRunStatus('run-1', RunStatus.Pending);
    expect(reset.completedAt).toBeUndefined();
    expect(reset.startedAt?.toISOString()).toBe('2026-02-19T02:00:05.000Z');
  });
});
