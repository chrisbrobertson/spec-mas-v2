import { describe, expect, it } from 'vitest';
import { resolveConfigWithTrace } from '../src/inheritance.js';

describe('config trace', () => {
  it('includes applied layers in order', () => {
    const result = resolveConfigWithTrace({
      global: {
        global: {
          default_timeout_seconds: 900,
          log_level: 'info'
        }
      },
      project: {
        project: {
          project_id: 'proj-1',
          workspace_root: '/repo',
          agents: {
            default_agent: 'agent-codex',
            fallback_chain: ['agent-codex'],
            overrides: {}
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false,
            channels: []
          },
          secrets: {}
        }
      },
      cli: {
        global: {
          default_timeout_seconds: 100
        }
      }
    });

    expect(result.appliedLayers).toEqual(['global', 'project', 'cli']);
    expect(result.resolved.global.default_timeout_seconds).toBe(100);
  });

  it('tracks issue-label as the last layer name', () => {
    const result = resolveConfigWithTrace({
      global: {
        global: {
          default_timeout_seconds: 900,
          log_level: 'info'
        }
      },
      project: {
        project: {
          project_id: 'proj-1',
          workspace_root: '/repo',
          agents: {
            default_agent: 'agent-codex',
            fallback_chain: ['agent-codex'],
            overrides: {}
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false,
            channels: []
          },
          secrets: {}
        }
      },
      issueLabel: {
        global: {
          default_timeout_seconds: 60
        }
      }
    });

    expect(result.appliedLayers).toEqual(['global', 'project', 'issue-label']);
    expect(result.resolved.global.default_timeout_seconds).toBe(60);
  });
});
