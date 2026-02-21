import { z } from 'zod';

export const GateSchema = z.enum(['G1', 'G2', 'G3', 'G4']);
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
export const NotificationChannelSchema = z.enum(['slack', 'email', 'webhook', 'github']);
export const SecretProviderSchema = z.enum(['env', 'vault']);

export const SecretRefSchema = z.object({
  provider: SecretProviderSchema,
  key: z.string().min(1),
  required: z.boolean().default(true)
}).strict();

export const AgentOverridesSchema = z.object({
  model: z.string().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  extraEnv: z.record(z.string(), z.string()).optional()
}).strict();

export const AgentExecutionModeSchema = z.enum(['local_cli', 'remote_api']);
export const ServiceExecutionModeSchema = z.enum(['local_process', 'containerized_dependency']);

const PhaseOverridesSchema = z
  .object({
    validate: z.string().min(1).optional(),
    plan: z.string().min(1).optional(),
    adversarial_review: z.string().min(1).optional(),
    implement: z.string().min(1).optional(),
    test: z.string().min(1).optional(),
    review: z.string().min(1).optional(),
    report: z.string().min(1).optional()
  })
  .strict();

const AgentsConfigBaseSchema = z
  .object({
    default_agent: z.string().min(1),
    phase_overrides: PhaseOverridesSchema.optional(),
    fallback_chain: z.array(z.string().min(1)).default([]),
    overrides: z.record(z.string(), AgentOverridesSchema).default({}),
    execution_mode: AgentExecutionModeSchema.default('local_cli'),
    remote_api_url: z.string().url().optional()
  })
  .strict();

export const AgentsConfigSchema = AgentsConfigBaseSchema.superRefine((value, context) => {
  if (value.execution_mode === 'remote_api' && !value.remote_api_url) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['remote_api_url'],
      message: 'remote_api_url is required when execution_mode=remote_api'
    });
  }
});

const AppServicesConfigSchema = z
  .object({
    api: ServiceExecutionModeSchema.default('local_process'),
    web: ServiceExecutionModeSchema.default('local_process'),
    orchestrator_worker: ServiceExecutionModeSchema.default('local_process')
  })
  .strict()
  .default({});

const DependencyServicesConfigSchema = z
  .object({
    openhands: ServiceExecutionModeSchema.default('containerized_dependency'),
    postgres: ServiceExecutionModeSchema.default('containerized_dependency'),
    mailhog: ServiceExecutionModeSchema.default('containerized_dependency'),
    sqlite_web: ServiceExecutionModeSchema.default('containerized_dependency')
  })
  .strict()
  .default({});

const DeploymentConfigBaseSchema = z
  .object({
    app_services: AppServicesConfigSchema,
    dependencies: DependencyServicesConfigSchema
  })
  .strict();

export const DeploymentConfigSchema = DeploymentConfigBaseSchema.superRefine((value, context) => {
  for (const [service, mode] of Object.entries(value.app_services)) {
    if (mode !== 'local_process') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['app_services', service],
        message: `v2 requires app service "${service}" to use local_process`
      });
    }
  }

  for (const [service, mode] of Object.entries(value.dependencies)) {
    if (mode !== 'containerized_dependency') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dependencies', service],
        message: `v2 requires dependency "${service}" to use containerized_dependency`
      });
    }
  }
});

export const WorkflowConfigSchema = z.object({
  max_parallel_phases: z.number().int().positive().default(1),
  required_gates: z.array(GateSchema).min(1).default(['G1', 'G2', 'G3', 'G4'])
}).strict();

export const NotificationsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  channels: z.array(NotificationChannelSchema).default([])
}).strict();

export const ProjectSettingsSchema = z.object({
  project_id: z.string().min(1),
  workspace_root: z.string().min(1),
  agents: AgentsConfigSchema,
  deployment: DeploymentConfigSchema.default({ app_services: {}, dependencies: {} }),
  workflow: WorkflowConfigSchema,
  notifications: NotificationsConfigSchema,
  secrets: z.record(z.string(), SecretRefSchema).default({})
}).strict();

export const GlobalSettingsSchema = z.object({
  default_timeout_seconds: z.number().int().positive().default(900),
  log_level: LogLevelSchema.default('info')
}).strict();

export const ResolvedConfigSchema = z.object({
  global: GlobalSettingsSchema,
  project: ProjectSettingsSchema
}).strict();

const AgentsConfigOverrideSchema = z
  .object({
    default_agent: z.string().min(1).optional(),
    phase_overrides: PhaseOverridesSchema.optional(),
    fallback_chain: z.array(z.string().min(1)).optional(),
    overrides: z.record(z.string(), AgentOverridesSchema).optional(),
    execution_mode: AgentExecutionModeSchema.optional(),
    remote_api_url: z.string().url().optional()
  })
  .strict();

const WorkflowConfigOverrideSchema = z
  .object({
    max_parallel_phases: z.number().int().positive().optional(),
    required_gates: z.array(GateSchema).min(1).optional()
  })
  .strict();

const NotificationsConfigOverrideSchema = z
  .object({
    enabled: z.boolean().optional(),
    channels: z.array(NotificationChannelSchema).optional()
  })
  .strict();

const AppServicesConfigOverrideSchema = z
  .object({
    api: ServiceExecutionModeSchema.optional(),
    web: ServiceExecutionModeSchema.optional(),
    orchestrator_worker: ServiceExecutionModeSchema.optional()
  })
  .strict();

const DependencyServicesConfigOverrideSchema = z
  .object({
    openhands: ServiceExecutionModeSchema.optional(),
    postgres: ServiceExecutionModeSchema.optional(),
    mailhog: ServiceExecutionModeSchema.optional(),
    sqlite_web: ServiceExecutionModeSchema.optional()
  })
  .strict();

const DeploymentConfigOverrideBaseSchema = z
  .object({
    app_services: AppServicesConfigOverrideSchema.optional(),
    dependencies: DependencyServicesConfigOverrideSchema.optional()
  })
  .strict();

const DeploymentConfigOverrideSchema = DeploymentConfigOverrideBaseSchema.superRefine((value, context) => {
  for (const [service, mode] of Object.entries(value.app_services ?? {})) {
    if (mode !== 'local_process') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['app_services', service],
        message: `v2 requires app service "${service}" to use local_process`
      });
    }
  }

  for (const [service, mode] of Object.entries(value.dependencies ?? {})) {
    if (mode !== 'containerized_dependency') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dependencies', service],
        message: `v2 requires dependency "${service}" to use containerized_dependency`
      });
    }
  }
});

const ProjectSettingsOverrideSchema = z
  .object({
    project_id: z.string().min(1).optional(),
    workspace_root: z.string().min(1).optional(),
    agents: AgentsConfigOverrideSchema.optional(),
    deployment: DeploymentConfigOverrideSchema.optional(),
    workflow: WorkflowConfigOverrideSchema.optional(),
    notifications: NotificationsConfigOverrideSchema.optional(),
    secrets: z.record(z.string(), SecretRefSchema).optional()
  })
  .strict();

const GlobalSettingsOverrideSchema = z
  .object({
    default_timeout_seconds: z.number().int().positive().optional(),
    log_level: LogLevelSchema.optional()
  })
  .strict();

export const ConfigOverrideSchema = z
  .object({
    global: GlobalSettingsOverrideSchema.optional(),
    project: ProjectSettingsOverrideSchema.optional()
  })
  .strict();

export const GlobalConfigSchema = z
  .object({
    global: GlobalSettingsSchema
  })
  .strict();

export const ProjectConfigSchema = z
  .object({
    project: ProjectSettingsSchema
  })
  .strict();

export const EnvConfigOverrideSchema = ConfigOverrideSchema;
export const CliConfigOverrideSchema = ConfigOverrideSchema;
export const IssueLabelConfigOverrideSchema = ConfigOverrideSchema;

export type SecretRef = z.infer<typeof SecretRefSchema>;
export type AgentExecutionMode = z.infer<typeof AgentExecutionModeSchema>;
export type ServiceExecutionMode = z.infer<typeof ServiceExecutionModeSchema>;
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type GlobalConfig = GlobalSettings;
export type ProjectConfig = ProjectSettings;
export type ResolvedConfig = z.infer<typeof ResolvedConfigSchema>;
export type ConfigOverride = z.input<typeof ConfigOverrideSchema>;
export type GlobalConfigFile = z.input<typeof GlobalConfigSchema>;
export type ProjectConfigFile = z.input<typeof ProjectConfigSchema>;
export type EnvConfigOverride = z.input<typeof EnvConfigOverrideSchema>;
export type CliConfigOverride = z.input<typeof CliConfigOverrideSchema>;
export type IssueLabelConfigOverride = z.input<typeof IssueLabelConfigOverrideSchema>;
