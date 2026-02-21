import { describe, expect, it } from 'vitest';
import { resolveConfigPrecedence } from '../src/precedence.js';

describe('config precedence', () => {
  it('applies layers in deterministic order', () => {
    const resolved = resolveConfigPrecedence({
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
            default_agent: 'agent-global',
            fallback_chain: ['agent-global'],
            overrides: {}
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1', 'G2', 'G3', 'G4']
          },
          notifications: {
            enabled: false,
            channels: []
          },
          secrets: {}
        }
      },
      env: {
        global: {
          default_timeout_seconds: 700
        },
        project: {
          agents: {
            default_agent: 'agent-env'
          }
        }
      },
      cli: {
        global: {
          default_timeout_seconds: 120
        },
        project: {
          agents: {
            default_agent: 'agent-cli'
          }
        }
      },
      issueLabel: {
        global: {
          default_timeout_seconds: 45
        },
        project: {
          agents: {
            default_agent: 'agent-issue',
            fallback_chain: ['agent-codex'],
            overrides: {}
          }
        }
      }
    });

    expect(resolved.global.default_timeout_seconds).toBe(45);
    expect(resolved.project.agents.default_agent).toBe('agent-issue');
    expect(resolved.project.agents.fallback_chain).toEqual(['agent-codex']);
  });

  it('replaces arrays rather than merging them', () => {
    const resolved = resolveConfigPrecedence({
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
            fallback_chain: ['agent-a', 'agent-b'],
            overrides: {}
          },
          workflow: {
            max_parallel_phases: 1,
            required_gates: ['G1', 'G2', 'G3']
          },
          notifications: {
            enabled: true,
            channels: ['slack', 'email']
          },
          secrets: {}
        }
      },
      env: {
        project: {
          notifications: {
            channels: ['github']
          },
          workflow: {
            required_gates: ['G1']
          }
        }
      }
    });

    expect(resolved.project.notifications.channels).toEqual(['github']);
    expect(resolved.project.workflow.required_gates).toEqual(['G1']);
  });

  it('applies execution mode and remote_api_url precedence across layers', () => {
    const resolved = resolveConfigPrecedence({
      global: {
        global: {
          default_timeout_seconds: 900,
          log_level: 'info'
        }
      },
      project: {
        project: {
          project_id: 'proj-remote',
          workspace_root: '/repo',
          agents: {
            default_agent: 'agent-codex',
            execution_mode: 'local_cli',
            fallback_chain: [],
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
      env: {
        project: {
          agents: {
            execution_mode: 'remote_api'
          }
        }
      },
      issueLabel: {
        project: {
          agents: {
            remote_api_url: 'https://api.example.com/specmas/issue-generate'
          }
        }
      }
    });

    expect(resolved.project.agents.execution_mode).toBe('remote_api');
    expect(resolved.project.agents.remote_api_url).toBe('https://api.example.com/specmas/issue-generate');
  });

  it('applies deployment execution-mode precedence across layers', () => {
    const resolved = resolveConfigPrecedence({
      global: {
        global: {
          default_timeout_seconds: 900,
          log_level: 'info'
        }
      },
      project: {
        project: {
          project_id: 'proj-deploy-precedence',
          workspace_root: '/repo',
          agents: {
            default_agent: 'agent-codex',
            fallback_chain: [],
            overrides: {}
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
            enabled: false,
            channels: []
          },
          secrets: {}
        }
      },
      env: {
        project: {
          deployment: {
            app_services: {
              orchestrator_worker: 'local_process'
            }
          }
        }
      },
      issueLabel: {
        project: {
          deployment: {
            dependencies: {
              postgres: 'containerized_dependency'
            }
          }
        }
      }
    });

    expect(resolved.project.deployment.app_services.orchestrator_worker).toBe('local_process');
    expect(resolved.project.deployment.dependencies.postgres).toBe('containerized_dependency');
  });

  it('fails when override layer attempts invalid deployment execution mode', () => {
    expect(() =>
      resolveConfigPrecedence({
        global: {
          global: {
            default_timeout_seconds: 900,
            log_level: 'info'
          }
        },
        project: {
          project: {
            project_id: 'proj-invalid-deploy-layer',
            workspace_root: '/repo',
            agents: {
              default_agent: 'agent-codex',
              fallback_chain: [],
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
        env: {
          project: {
            deployment: {
              dependencies: {
                openhands: 'local_process'
              }
            }
          }
        }
      })
    ).toThrow(/v2 requires dependency .*containerized_dependency/);
  });

  it('fails when execution_mode resolves to remote_api without remote_api_url', () => {
    expect(() =>
      resolveConfigPrecedence({
        global: {
          global: {
            default_timeout_seconds: 900,
            log_level: 'info'
          }
        },
        project: {
          project: {
            project_id: 'proj-missing-remote-url',
            workspace_root: '/repo',
            agents: {
              default_agent: 'agent-codex',
              fallback_chain: [],
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
        env: {
          project: {
            agents: {
              execution_mode: 'remote_api'
            }
          }
        }
      })
    ).toThrow('remote_api_url is required when execution_mode=remote_api');
  });

  it('fails fast on invalid override data', () => {
    const invalidLayers = {
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
            fallback_chain: [],
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
      env: {
        project: {
          workflow: {
            required_gates: ['G5']
          }
        }
      }
    } as unknown as Parameters<typeof resolveConfigPrecedence>[0];

    expect(() => resolveConfigPrecedence(invalidLayers)).toThrow();
  });

  it('fails when required base layers are absent', () => {
    expect(() =>
      resolveConfigPrecedence({
        global: {
          global: {
            default_timeout_seconds: 900,
            log_level: 'info'
          }
        }
      })
    ).toThrow();
  });
});
