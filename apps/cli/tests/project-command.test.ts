import { describe, expect, it } from 'vitest';
import { InMemoryProjectService } from '../src/services.js';
import { runCliCommand } from './test-utils.js';

describe('project-command', () => {
  it('creates, lists, shows, and removes projects', async () => {
    const projectService = new InMemoryProjectService();

    const created = await runCliCommand(
      ['project', 'create', 'proj-1', '--key', 'alpha', '--name', 'Alpha', '--repo', '/repo/alpha'],
      { projectService }
    );
    expect(created.error).toBeUndefined();
    expect(created.io.output[0]).toContain('id: proj-1');

    const listed = await runCliCommand(['project', 'list', '--format', 'json'], { projectService });
    expect(listed.error).toBeUndefined();
    expect(JSON.parse(listed.io.output[0])).toEqual([
      { id: 'proj-1', key: 'alpha', name: 'Alpha', repoPath: '/repo/alpha' }
    ]);

    const shown = await runCliCommand(['project', 'show', 'proj-1'], { projectService });
    expect(shown.error).toBeUndefined();
    expect(shown.io.output[0]).toContain('name: Alpha');

    const removed = await runCliCommand(['project', 'remove', 'proj-1', '--format', 'json'], { projectService });
    expect(removed.error).toBeUndefined();
    expect(JSON.parse(removed.io.output[0])).toEqual({ projectId: 'proj-1', removed: true });
  });

  it('fails when showing a missing project', async () => {
    const result = await runCliCommand(['project', 'show', 'missing']);

    expect(result.error?.message).toBe('Project not found: missing');
  });

  it('fails when creating duplicate project ids', async () => {
    const projectService = new InMemoryProjectService([
      { id: 'proj-1', key: 'alpha', name: 'Alpha', repoPath: '/repo/alpha' }
    ]);

    const result = await runCliCommand(
      ['project', 'create', 'proj-1', '--key', 'alpha', '--name', 'Alpha', '--repo', '/repo/alpha'],
      { projectService }
    );

    expect(result.error?.message).toBe('Project already exists: proj-1');
  });

  it('handles empty project lists deterministically', async () => {
    const result = await runCliCommand(['project', 'list']);

    expect(result.error).toBeUndefined();
    expect(result.io.output[0]).toBe('ID\tKEY\tNAME\tREPO');
  });
});
