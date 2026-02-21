import { describe, expect, it } from 'vitest';
import { parseWorkflowYaml } from '../src/schema.js';

describe('workflow schema parser', () => {
  it('parses valid workflow yaml', () => {
    const result = parseWorkflowYaml(`
name: Release Workflow
phases:
  - id: implement
    mode: sequential
    tasks: [task-1, task-2]
    gates: [G1, G2]
`);

    expect(result.diagnostics).toEqual([]);
    expect(result.workflow?.name).toBe('Release Workflow');
    expect(result.workflow?.phases[0]?.tasks).toEqual(['task-1', 'task-2']);
  });

  it('returns actionable diagnostics for invalid workflow', () => {
    const result = parseWorkflowYaml(`
name:
phases:
  - id: implement
    mode: serial
    tasks: []
`);

    expect(result.workflow).toBeNull();
    expect(result.diagnostics.map((entry) => entry.path)).toEqual(
      expect.arrayContaining(['name', 'phases[0].mode', 'phases[0].tasks'])
    );
  });

  it('rejects malformed yaml input', () => {
    const result = parseWorkflowYaml('name: test\nphases: [');
    expect(result.workflow).toBeNull();
    expect(result.diagnostics[0]?.message).toContain('Invalid YAML');
  });
});
