import { describe, expect, it } from 'vitest';
import {
  CliConfigOverrideSchema,
  EnvConfigOverrideSchema,
  GlobalConfigSchema,
  ProjectConfigSchema
} from '../src/schema.js';

describe('config schema', () => {
  it('parses valid global and project config files', () => {
    const globalConfig = GlobalConfigSchema.parse({
      global: {
        default_timeout_seconds: 600,
        log_level: 'debug'
      }
    });

    const projectConfig = ProjectConfigSchema.parse({
      project: {
        project_id: 'proj-1',
        workspace_root: '/tmp/proj',
        agents: {
          default_agent: 'agent-codex',
          fallback_chain: ['agent-codex'],
          overrides: {}
        },
        workflow: {
          max_parallel_phases: 2,
          required_gates: ['G1', 'G2']
        },
        notifications: {
          enabled: true,
          channels: ['slack']
        },
        secrets: {}
      }
    });

    expect(globalConfig.global.default_timeout_seconds).toBe(600);
    expect(projectConfig.project.workflow.max_parallel_phases).toBe(2);
  });

  it('rejects invalid override values', () => {
    expect(() =>
      EnvConfigOverrideSchema.parse({
        global: {
          log_level: 'verbose'
        }
      })
    ).toThrow();

    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-1',
          workspace_root: '/tmp/proj',
          agents: {
            default_agent: 'agent-codex',
            phase_overrides: {
              implement: ''
            }
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {}
        }
      })
    ).toThrow();
  });

  it('applies deterministic defaults for optional fields', () => {
    const projectConfig = ProjectConfigSchema.parse({
      project: {
        project_id: 'proj-2',
        workspace_root: '/tmp/p2',
        agents: {
          default_agent: 'agent-claude-code'
        },
        workflow: {
          max_parallel_phases: 1,
          required_gates: ['G1']
        },
        notifications: {
          enabled: false
        },
        secrets: {}
      }
    });

    const cliOverride = CliConfigOverrideSchema.parse({
      project: {
        notifications: {
          enabled: true
        }
      }
    });

    expect(projectConfig.project.agents.fallback_chain).toEqual([]);
    expect(projectConfig.project.agents.execution_mode).toBe('local_cli');
    expect(projectConfig.project.deployment.app_services.api).toBe('local_process');
    expect(projectConfig.project.deployment.dependencies.openhands).toBe('containerized_dependency');
    expect(projectConfig.project.notifications.channels).toEqual([]);
    expect(cliOverride.project?.notifications?.enabled).toBe(true);
  });

  it('accepts explicit v2-compliant deployment execution modes', () => {
    const config = ProjectConfigSchema.parse({
      project: {
        project_id: 'proj-deploy-ok',
        workspace_root: '/tmp/p-deploy-ok',
        agents: {
          default_agent: 'agent-codex'
        },
        deployment: {
          app_services: {
            api: 'local_process',
            web: 'local_process',
            orchestrator_worker: 'local_process'
          },
          dependencies: {
            openhands: 'containerized_dependency',
            postgres: 'containerized_dependency',
            mailhog: 'containerized_dependency',
            sqlite_web: 'containerized_dependency'
          }
        },
        workflow: {
          max_parallel_phases: 1,
          required_gates: ['G1']
        },
        notifications: {
          enabled: false
        },
        secrets: {}
      }
    });

    expect(config.project.deployment.app_services.orchestrator_worker).toBe('local_process');
    expect(config.project.deployment.dependencies.sqlite_web).toBe('containerized_dependency');
  });

  it('rejects invalid v2 deployment mode combinations', () => {
    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-bad-app-svc-mode',
          workspace_root: '/tmp/p-bad-app-svc-mode',
          agents: {
            default_agent: 'agent-codex'
          },
          deployment: {
            app_services: {
              api: 'containerized_dependency'
            }
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {}
        }
      })
    ).toThrow(/v2 requires app service .*local_process/);

    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-bad-dep-mode',
          workspace_root: '/tmp/p-bad-dep-mode',
          agents: {
            default_agent: 'agent-codex'
          },
          deployment: {
            dependencies: {
              openhands: 'local_process'
            }
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {}
        }
      })
    ).toThrow(/v2 requires dependency .*containerized_dependency/);
  });

  it('requires remote_api_url when execution_mode is remote_api', () => {
    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-remote-missing',
          workspace_root: '/tmp/p-remote-missing',
          agents: {
            default_agent: 'agent-codex',
            execution_mode: 'remote_api'
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {}
        }
      })
    ).toThrow('remote_api_url is required when execution_mode=remote_api');
  });

  it('accepts remote_api execution_mode with valid remote_api_url', () => {
    const config = ProjectConfigSchema.parse({
      project: {
        project_id: 'proj-remote',
        workspace_root: '/tmp/p-remote',
        agents: {
          default_agent: 'agent-gemini-cli',
          execution_mode: 'remote_api',
          remote_api_url: 'https://api.example.com/specmas/generate'
        },
        workflow: {
          max_parallel_phases: 1,
          required_gates: ['G1']
        },
        notifications: {
          enabled: false
        },
        secrets: {}
      }
    });

    expect(config.project.agents.execution_mode).toBe('remote_api');
    expect(config.project.agents.remote_api_url).toBe('https://api.example.com/specmas/generate');
  });

  it('rejects malformed remote_api_url values', () => {
    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-remote-invalid-url',
          workspace_root: '/tmp/p-remote-invalid-url',
          agents: {
            default_agent: 'agent-codex',
            execution_mode: 'remote_api',
            remote_api_url: 'not-a-valid-url'
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {}
        }
      })
    ).toThrow();
  });

  it('rejects malformed project config structure', () => {
    expect(() =>
      ProjectConfigSchema.parse({
        project: {
          project_id: 'proj-3',
          workspace_root: '/tmp/p3',
          agents: {
            default_agent: 'agent-codex'
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1']
          },
          notifications: {
            enabled: false
          },
          secrets: {},
          unknown: true
        }
      })
    ).toThrow();
  });
});
