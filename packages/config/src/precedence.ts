import {
  CliConfigOverrideSchema,
  EnvConfigOverrideSchema,
  GlobalConfigSchema,
  IssueLabelConfigOverrideSchema,
  ProjectConfigSchema,
  ResolvedConfigSchema,
  type CliConfigOverride,
  type EnvConfigOverride,
  type GlobalConfigFile,
  type IssueLabelConfigOverride,
  type ProjectConfigFile,
  type ResolvedConfig
} from './schema.js';

export const CONFIG_PRECEDENCE_ORDER = ['global', 'project', 'env', 'cli', 'issueLabel'] as const;
type ConfigLayerName = (typeof CONFIG_PRECEDENCE_ORDER)[number];

export interface ConfigLayers {
  global?: GlobalConfigFile;
  project?: ProjectConfigFile;
  env?: EnvConfigOverride;
  cli?: CliConfigOverride;
  issueLabel?: IssueLabelConfigOverride;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeValue(base: unknown, override: unknown): unknown {
  if (override === undefined) {
    return base;
  }
  if (Array.isArray(override)) {
    return override;
  }
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      merged[key] = mergeValue(merged[key], value);
    }
    return merged;
  }
  return override;
}

function normalizeLayer(name: ConfigLayerName, layers: ConfigLayers): Record<string, unknown> | undefined {
  const layer = layers[name];
  if (!layer) {
    return undefined;
  }

  switch (name) {
    case 'global':
      return GlobalConfigSchema.parse(layer);
    case 'project':
      return ProjectConfigSchema.parse(layer);
    case 'env':
      return EnvConfigOverrideSchema.parse(layer);
    case 'cli':
      return CliConfigOverrideSchema.parse(layer);
    case 'issueLabel':
      return IssueLabelConfigOverrideSchema.parse(layer);
    default: {
      const impossible: never = name;
      throw new Error(`Unhandled config layer: ${impossible}`);
    }
  }
}

export function resolveConfigPrecedence(layers: ConfigLayers): ResolvedConfig {
  let merged: unknown = {};
  for (const layerName of CONFIG_PRECEDENCE_ORDER) {
    const layer = normalizeLayer(layerName, layers);
    merged = mergeValue(merged, layer);
  }

  return ResolvedConfigSchema.parse(merged);
}
