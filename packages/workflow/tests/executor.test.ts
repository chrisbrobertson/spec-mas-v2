import { describe, expect, it } from 'vitest';
import { assertMergeReady, executeWorkflow } from '../src/executor.js';
import type { WorkflowDefinition } from '../src/schema.js';

describe('workflow executor', () => {
  it('runs sequential phase tasks in order', async () => {
    const order: string[] = [];
    const workflow: WorkflowDefinition = {
      version: 1,
      name: 'seq',
      phases: [{ id: 'p1', mode: 'sequential', tasks: ['t1', 't2'], gates: [] }]
    };

    const result = await executeWorkflow(workflow, {
      async runTask(taskId) {
        order.push(taskId);
        return { ok: true, output: `done:${taskId}` };
      }
    });

    expect(order).toEqual(['t1', 't2']);
    expect(result.status).toBe('passed');
  });

  it('runs parallel phase tasks without requiring sequence order', async () => {
    const order: string[] = [];
    const workflow: WorkflowDefinition = {
      version: 1,
      name: 'par',
      phases: [{ id: 'p1', mode: 'parallel', tasks: ['t1', 't2'], gates: [] }]
    };

    const result = await executeWorkflow(workflow, {
      async runTask(taskId) {
        if (taskId === 't1') {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        order.push(taskId);
        return { ok: true, output: `done:${taskId}` };
      }
    });

    expect(order).toHaveLength(2);
    expect(result.phases[0]?.tasks.map((task) => task.taskId).sort()).toEqual(['t1', 't2']);
  });

  it('stops at first failing phase', async () => {
    const workflow: WorkflowDefinition = {
      version: 1,
      name: 'fail-fast',
      phases: [
        { id: 'p1', mode: 'sequential', tasks: ['t1'], gates: [] },
        { id: 'p2', mode: 'sequential', tasks: ['t2'], gates: [] }
      ]
    };

    const result = await executeWorkflow(workflow, {
      async runTask(taskId) {
        return taskId === 't1'
          ? { ok: false, output: 'bad', error: 'failed' }
          : { ok: true, output: 'good' };
      }
    });

    expect(result.status).toBe('failed');
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]?.tasks[0]?.status).toBe('failed');
  });

  it('blocks merge unless merge approval is approved', () => {
    expect(() => assertMergeReady('awaiting_human_approval')).toThrow(
      'merge blocked: status is awaiting_human_approval'
    );
    expect(() => assertMergeReady('approved')).not.toThrow();
  });
});
