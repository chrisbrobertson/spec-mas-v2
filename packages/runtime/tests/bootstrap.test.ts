import { describe, expect, it } from 'vitest';
import { assertRuntimeBootstrap } from '../src/bootstrap.js';

describe('runtime bootstrap guardrails', () => {
  it('requires docker when OpenHands is enabled', () => {
    const result = assertRuntimeBootstrap({
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
      dockerAvailable: true,
      openhandsEnabled: true
    });

    expect(result.dockerRequired).toBe(true);
  });

  it('requires docker when containerized dependencies are enabled', () => {
    const result = assertRuntimeBootstrap({
      profile: {
        appServices: {
          api: 'local_process',
          web: 'local_process',
          orchestrator_worker: 'local_process'
        },
        dependencies: {
          postgres: 'containerized_dependency',
          mailhog: 'containerized_dependency'
        }
      },
      dockerAvailable: true,
      openhandsEnabled: false,
      enabledDependencies: ['postgres', 'mailhog']
    });

    expect(result.dockerRequired).toBe(true);
  });

  it('does not require docker when OpenHands and optional dependencies are disabled', () => {
    const result = assertRuntimeBootstrap({
      profile: {
        appServices: {
          api: 'local_process',
          web: 'local_process',
          orchestrator_worker: 'local_process'
        }
      },
      dockerAvailable: false,
      openhandsEnabled: false,
      enabledDependencies: []
    });

    expect(result.dockerRequired).toBe(false);
  });

  it('rejects app service containerization in v2 mode', () => {
    expect(() =>
      assertRuntimeBootstrap({
        profile: {
          appServices: {
            api: 'containerized_dependency'
          }
        },
        dockerAvailable: true,
        openhandsEnabled: false
      })
    ).toThrow('v2 requires app service "api" to use local_process');
  });

  it('rejects dependency local_process mode in v2', () => {
    expect(() =>
      assertRuntimeBootstrap({
        profile: {
          dependencies: {
            openhands: 'local_process'
          }
        },
        dockerAvailable: true,
        openhandsEnabled: true
      })
    ).toThrow('v2 requires dependency "openhands" to use containerized_dependency');
  });

  it('fails fast when docker is unavailable but required', () => {
    expect(() =>
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
      })
    ).toThrow('Docker is required when OpenHands or containerized dependencies are enabled');
  });
});
