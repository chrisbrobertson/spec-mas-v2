import { describe, expect, it } from 'vitest';
import { InMemoryProjectRegistry } from '../src/projectRegistry.js';

function createDeterministicClock(isoTimestamps: string[]): () => Date {
  let index = 0;
  return () => {
    const value = isoTimestamps[Math.min(index, isoTimestamps.length - 1)];
    index += 1;
    return new Date(value);
  };
}

describe('project registry', () => {
  it('creates, updates, lists and removes projects', () => {
    const registry = new InMemoryProjectRegistry(
      createDeterministicClock(['2026-02-19T00:00:00.000Z', '2026-02-19T00:00:10.000Z'])
    );

    registry.create({ id: 'p1', name: 'Alpha', repoUrl: 'https://github.com/org/alpha' });
    const updated = registry.update('p1', { name: 'Alpha Updated', configYaml: 'workflow: default' });

    expect(updated.defaultBranch).toBe('main');
    expect(updated.name).toBe('Alpha Updated');
    expect(updated.configYaml).toBe('workflow: default');
    expect(updated.updatedAt.toISOString()).toBe('2026-02-19T00:00:10.000Z');

    expect(registry.list()).toHaveLength(1);
    expect(registry.remove('p1')).toBe(true);
    expect(registry.get('p1')).toBeUndefined();
  });

  it('rejects duplicate id and repository URL registrations', () => {
    const registry = new InMemoryProjectRegistry();
    registry.create({ id: 'p1', name: 'Alpha', repoUrl: 'https://github.com/org/alpha' });

    expect(() =>
      registry.create({ id: 'p1', name: 'Alpha 2', repoUrl: 'https://github.com/org/alpha-2' })
    ).toThrow('Project already exists: p1');

    expect(() =>
      registry.create({ id: 'p2', name: 'Alpha 2', repoUrl: 'https://github.com/org/alpha' })
    ).toThrow('Project repository already registered: https://github.com/org/alpha');
  });

  it('keeps list order deterministic and returns safe clones', () => {
    const registry = new InMemoryProjectRegistry();
    registry.create({ id: 'p2', name: 'Beta', repoUrl: 'https://github.com/org/beta' });
    registry.create({ id: 'p1', name: 'Alpha', repoUrl: 'https://github.com/org/alpha' });

    const listed = registry.list();
    expect(listed.map((project) => project.id)).toEqual(['p1', 'p2']);

    listed[0].name = 'Mutated';
    const stored = registry.get('p1');
    expect(stored?.name).toBe('Alpha');
  });

  it('fails on update for unknown project ids', () => {
    const registry = new InMemoryProjectRegistry();
    expect(() => registry.update('unknown', { name: 'Nope' })).toThrow('Project not found: unknown');
  });

  it('rejects empty required fields', () => {
    const registry = new InMemoryProjectRegistry();
    expect(() => registry.create({ id: 'p1', name: ' ', repoUrl: 'https://github.com/org/alpha' })).toThrow(
      'Project name must not be empty'
    );

    registry.create({ id: 'p1', name: 'Alpha', repoUrl: 'https://github.com/org/alpha' });
    expect(() => registry.update('p1', { defaultBranch: '   ' })).toThrow(
      'Project defaultBranch must not be empty'
    );
  });
});
