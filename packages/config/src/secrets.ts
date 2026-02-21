import type { SecretRef } from './schema.js';

export interface SecretSource {
  env: Record<string, string | undefined>;
  vault?: Record<string, string | undefined>;
}

export interface AgentSecretScope {
  agentId: string;
  refs: Record<string, SecretRef>;
}

function resolveSingleSecret(name: string, ref: SecretRef, source: SecretSource): string | undefined {
  if (ref.provider === 'env') {
    return source.env[ref.key];
  }
  return source.vault?.[ref.key];
}

export function resolveSecrets(
  refs: Record<string, SecretRef>,
  source: SecretSource
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [name, ref] of Object.entries(refs)) {
    const value = resolveSingleSecret(name, ref, source);
    if (!value && ref.required) {
      throw new Error(`Missing required secret: ${name}`);
    }
    if (value) {
      resolved[name] = value;
    }
  }

  return resolved;
}

export function injectSecretsForAgent(scope: AgentSecretScope, source: SecretSource): Record<string, string> {
  return resolveSecrets(scope.refs, source);
}
