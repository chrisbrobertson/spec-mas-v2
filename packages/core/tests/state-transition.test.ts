import { describe, expect, it } from 'vitest';
import { PhaseStatus, RunStatus, TaskStatus } from '../src/domain.js';
import {
  assertPhaseTransition,
  assertRunTransition,
  assertTaskTransition,
  isPhaseTransitionAllowed,
  isRunTransitionAllowed,
  isTaskTransitionAllowed
} from '../src/stateTransitions.js';

describe('state transitions', () => {
  it('allows valid run, phase and task transitions', () => {
    expect(() => assertRunTransition(RunStatus.Pending, RunStatus.Running)).not.toThrow();
    expect(() => assertPhaseTransition(PhaseStatus.Running, PhaseStatus.Completed)).not.toThrow();
    expect(() => assertTaskTransition(TaskStatus.Blocked, TaskStatus.Running)).not.toThrow();
  });

  it('rejects invalid transitions deterministically', () => {
    expect(() => assertRunTransition(RunStatus.Completed, RunStatus.Running)).toThrow(
      'Illegal run transition: completed -> running'
    );
    expect(() => assertPhaseTransition(PhaseStatus.Skipped, PhaseStatus.Completed)).toThrow(
      'Illegal phase transition: skipped -> completed'
    );
    expect(() => assertTaskTransition(TaskStatus.Completed, TaskStatus.Pending)).toThrow(
      'Illegal task transition: completed -> pending'
    );
  });

  it('exposes pure boolean guard checks', () => {
    expect(isRunTransitionAllowed(RunStatus.Paused, RunStatus.Running)).toBe(true);
    expect(isRunTransitionAllowed(RunStatus.Pending, RunStatus.Completed)).toBe(false);
    expect(isPhaseTransitionAllowed(PhaseStatus.Pending, PhaseStatus.Cancelled)).toBe(true);
    expect(isPhaseTransitionAllowed(PhaseStatus.Completed, PhaseStatus.Pending)).toBe(false);
    expect(isTaskTransitionAllowed(TaskStatus.Failed, TaskStatus.Pending)).toBe(true);
    expect(isTaskTransitionAllowed(TaskStatus.Cancelled, TaskStatus.Completed)).toBe(false);
  });
});
