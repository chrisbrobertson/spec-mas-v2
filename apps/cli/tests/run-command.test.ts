import { describe, expect, it } from 'vitest';
import { InMemoryRunService } from '../src/services.js';
import { runCliCommand } from './test-utils.js';

describe('run-command', () => {
  it('starts, checks status, and cancels runs', async () => {
    const runService = new InMemoryRunService();

    const started = await runCliCommand(
      ['run', 'start', '--project', 'proj-1', '--spec', 'specs/payments.md', '--format', 'json'],
      { runService }
    );

    expect(started.error).toBeUndefined();
    expect(JSON.parse(started.io.output[0])).toEqual({
      id: 'run-0001',
      projectId: 'proj-1',
      specPath: 'specs/payments.md',
      status: 'running'
    });

    const status = await runCliCommand(['run', 'status', 'run-0001'], { runService });
    expect(status.error).toBeUndefined();
    expect(status.io.output[0]).toContain('status: running');

    const cancelled = await runCliCommand(['run', 'cancel', 'run-0001', '--format', 'json'], { runService });
    expect(cancelled.error).toBeUndefined();
    expect(JSON.parse(cancelled.io.output[0]).status).toBe('cancelled');
  });

  it('validates required start arguments', async () => {
    const missingProject = await runCliCommand(['run', 'start', '--spec', 'specs/payments.md']);
    expect(missingProject.error?.message).toContain("required option '--project <projectId>' not specified");

    const missingSpec = await runCliCommand(['run', 'start', '--project', 'proj-1']);
    expect(missingSpec.error?.message).toContain("required option '--spec <specPath>' not specified");
  });

  it('fails status and cancel for missing runs', async () => {
    const status = await runCliCommand(['run', 'status', 'run-9999']);
    expect(status.error?.message).toBe('Run not found: run-9999');

    const cancel = await runCliCommand(['run', 'cancel', 'run-9999']);
    expect(cancel.error?.message).toBe('Run not found: run-9999');
  });

  it('keeps cancel idempotent for already cancelled runs', async () => {
    const runService = new InMemoryRunService([
      {
        id: 'run-1000',
        projectId: 'proj-1',
        specPath: 'specs/payments.md',
        status: 'cancelled'
      }
    ]);

    const cancelled = await runCliCommand(['run', 'cancel', 'run-1000', '--format', 'json'], { runService });

    expect(cancelled.error).toBeUndefined();
    expect(JSON.parse(cancelled.io.output[0]).status).toBe('cancelled');
  });
});
