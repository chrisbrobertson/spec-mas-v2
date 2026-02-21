export type ServiceExecutionMode = 'local_process' | 'containerized_dependency';

export interface RuntimeBootstrapProfile {
  appServices?: Partial<
    Record<'api' | 'web' | 'orchestrator_worker', ServiceExecutionMode>
  >;
  app_services?: Partial<
    Record<'api' | 'web' | 'orchestrator_worker', ServiceExecutionMode>
  >;
  dependencies?: Partial<
    Record<'openhands' | 'postgres' | 'mailhog' | 'sqlite_web', ServiceExecutionMode>
  >;
}

export interface RuntimeBootstrapInput {
  profile: RuntimeBootstrapProfile;
  dockerAvailable: boolean;
  openhandsEnabled: boolean;
  enabledDependencies?: Array<'postgres' | 'mailhog' | 'sqlite_web'>;
}

export interface RuntimeBootstrapResult {
  dockerRequired: boolean;
}

function validateV2Profile(profile: RuntimeBootstrapProfile): void {
  const appServices = profile.appServices ?? profile.app_services ?? {};
  for (const [service, mode] of Object.entries(appServices)) {
    if (mode !== 'local_process') {
      throw new Error(`v2 requires app service "${service}" to use local_process`);
    }
  }

  for (const [service, mode] of Object.entries(profile.dependencies ?? {})) {
    if (mode !== 'containerized_dependency') {
      throw new Error(`v2 requires dependency "${service}" to use containerized_dependency`);
    }
  }
}

function isContainerizedDependencyEnabled(
  profile: RuntimeBootstrapProfile,
  dependency: 'postgres' | 'mailhog' | 'sqlite_web'
): boolean {
  const mode = profile.dependencies?.[dependency];
  return mode === undefined || mode === 'containerized_dependency';
}

export function assertRuntimeBootstrap(input: RuntimeBootstrapInput): RuntimeBootstrapResult {
  validateV2Profile(input.profile);

  const dependencies = input.enabledDependencies ?? [];
  const dependencyRequiresDocker = dependencies.some((dependency) =>
    isContainerizedDependencyEnabled(input.profile, dependency)
  );
  const dockerRequired = input.openhandsEnabled || dependencyRequiresDocker;

  if (dockerRequired && !input.dockerAvailable) {
    throw new Error('Docker is required when OpenHands or containerized dependencies are enabled');
  }

  return { dockerRequired };
}
