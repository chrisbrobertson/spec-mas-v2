import type { SandboxConfig, SandboxHandle } from './contracts.js';

function validateConfig(config: SandboxConfig): void {
  if (!config.image) {
    throw new Error('Sandbox image is required');
  }
  if (!config.workspacePath) {
    throw new Error('Workspace path is required');
  }
  if (!config.workspacePath.startsWith('/')) {
    throw new Error('Workspace path must be absolute');
  }
  if (config.workspacePath.includes('..')) {
    throw new Error('Workspace path cannot include traversal segments');
  }
  if (config.cpuLimit <= 0) {
    throw new Error('CPU limit must be positive');
  }
  if (config.cpuLimit > 32) {
    throw new Error('CPU limit must be less than or equal to 32');
  }
  if (config.memoryMb < 256) {
    throw new Error('Memory must be at least 256MB');
  }
  if (config.memoryMb > 262144) {
    throw new Error('Memory must be less than or equal to 262144MB');
  }
}

export class SandboxProvisioner {
  private sequence = 1;

  provision(config: SandboxConfig): SandboxHandle {
    validateConfig(config);

    const id = `sandbox-${String(this.sequence).padStart(4, '0')}`;
    this.sequence += 1;

    return {
      id,
      config
    };
  }
}
