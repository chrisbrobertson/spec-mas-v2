import { describe, expect, it } from 'vitest';
import { SandboxProvisioner } from '../src/provisioner.js';

describe('sandbox provisioner', () => {
  it('creates deterministic sequential sandbox ids', () => {
    const provisioner = new SandboxProvisioner();
    const first = provisioner.provision({
      image: 'specmas/runtime:latest',
      workspacePath: '/repo',
      cpuLimit: 1,
      memoryMb: 1024,
      networkEnabled: false
    });
    const second = provisioner.provision({
      image: 'specmas/runtime:latest',
      workspacePath: '/repo',
      cpuLimit: 1,
      memoryMb: 1024,
      networkEnabled: false
    });

    expect(first.id).toBe('sandbox-0001');
    expect(second.id).toBe('sandbox-0002');
  });

  it('rejects invalid memory', () => {
    const provisioner = new SandboxProvisioner();

    expect(() =>
      provisioner.provision({
        image: 'specmas/runtime:latest',
        workspacePath: '/repo',
        cpuLimit: 1,
        memoryMb: 128,
        networkEnabled: false
      })
    ).toThrow('Memory must be at least 256MB');
  });

  it('rejects workspace traversal paths', () => {
    const provisioner = new SandboxProvisioner();

    expect(() =>
      provisioner.provision({
        image: 'specmas/runtime:latest',
        workspacePath: '/repo/../secret',
        cpuLimit: 1,
        memoryMb: 512,
        networkEnabled: false
      })
    ).toThrow('Workspace path cannot include traversal segments');
  });
});
