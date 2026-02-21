import { resolveConfigPrecedence, type ConfigLayers } from './precedence.js';
import type { ResolvedConfig } from './schema.js';

export interface ResolvedConfigTrace {
  resolved: ResolvedConfig;
  appliedLayers: string[];
}

export function resolveConfigWithTrace(layers: ConfigLayers): ResolvedConfigTrace {
  const appliedLayers: string[] = [];
  if (layers.global) appliedLayers.push('global');
  if (layers.project) appliedLayers.push('project');
  if (layers.env) appliedLayers.push('env');
  if (layers.cli) appliedLayers.push('cli');
  if (layers.issueLabel) appliedLayers.push('issue-label');

  const resolved = resolveConfigPrecedence(layers);
  return {
    resolved,
    appliedLayers
  };
}
