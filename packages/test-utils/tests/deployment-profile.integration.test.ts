import { describe, expect, it } from 'vitest';
import { ProjectConfigSchema } from '../../config/src/schema.js';
import { assertRuntimeBootstrap } from '../../runtime/src/bootstrap.js';
import { runIntegrationMatrix } from '../src/matrix.js';

describe('deployment profile integration matrix', () => {
  it('passes for local app services plus containerized dependencies', async () => {
    const result = await runIntegrationMatrix([
      {
        id: 'config-schema-v2-profile',
        components: ['config', 'runtime'],
        run: async () => {
          const parsed = ProjectConfigSchema.parse({
            project: {
              project_id: 'proj-integration-ok',
              workspace_root: '/repo',
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

          const bootstrap = assertRuntimeBootstrap({
            profile: parsed.project.deployment,
            dockerAvailable: true,
            openhandsEnabled: true
          });

          return bootstrap.dockerRequired === true;
        }
      }
    ]);

    expect(result.pass).toBe(true);
    expect(result.scenarios).toEqual([
      { id: 'config-schema-v2-profile', components: ['config', 'runtime'], pass: true }
    ]);
  });

  it('fails matrix when app service is containerized', async () => {
    const result = await runIntegrationMatrix([
      {
        id: 'reject-containerized-app-service',
        components: ['config', 'runtime'],
        run: async () => {
          try {
            ProjectConfigSchema.parse({
              project: {
                project_id: 'proj-integration-bad-app',
                workspace_root: '/repo',
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
            });
            return false;
          } catch {
            return true;
          }
        }
      }
    ]);

    expect(result.pass).toBe(true);
    expect(result.scenarios[0]?.pass).toBe(true);
  });

  it('fails matrix when docker is unavailable but required by runtime profile', async () => {
    const result = await runIntegrationMatrix([
      {
        id: 'docker-required-for-openhands',
        components: ['runtime'],
        run: async () => {
          try {
            assertRuntimeBootstrap({
              profile: {
                appServices: {
                  api: 'local_process',
                  web: 'local_process',
                  orchestrator_worker: 'local_process'
                },
                dependencies: {
                  openhands: 'containerized_dependency'
                }
              },
              dockerAvailable: false,
              openhandsEnabled: true
            });
            return false;
          } catch {
            return true;
          }
        }
      }
    ]);

    expect(result.pass).toBe(true);
    expect(result.scenarios[0]?.pass).toBe(true);
  });
});
