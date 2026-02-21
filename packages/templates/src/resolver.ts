import type { TemplateManifest, TemplateVariable } from './registry.js';

export interface VariableResolutionResult {
  values: Record<string, string | number | boolean>;
  errors: string[];
}

export interface RenderedTemplate {
  content: string;
  values: Record<string, string | number | boolean>;
}

type TemplateValue = string | number | boolean;

function coerceValue(
  variable: TemplateVariable,
  value: unknown
): string | number | boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (variable.type === 'string' && typeof value === 'string') {
    return value;
  }
  if (variable.type === 'number' && typeof value === 'number') {
    return value;
  }
  if (variable.type === 'boolean' && typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function computedValue(
  variable: TemplateVariable,
  values: Record<string, TemplateValue>
): TemplateValue | undefined {
  if (!variable.computed) {
    return undefined;
  }

  if (variable.computed.op === 'concat') {
    return variable.computed.parts
      .map((part) => {
        if (part.startsWith('$')) {
          const dependency = part.slice(1);
          return String(values[dependency] ?? '');
        }
        return part;
      })
      .join('');
  }

  return undefined;
}

function validateEnum(variable: TemplateVariable, value: TemplateValue): boolean {
  if (!variable.enumValues || variable.enumValues.length === 0) {
    return true;
  }
  return variable.enumValues.some((candidate) => candidate === value);
}

export function resolveTemplateVariables(
  manifest: TemplateManifest,
  provided: Record<string, unknown>
): VariableResolutionResult {
  const values: Record<string, TemplateValue> = {};
  const errors: string[] = [];

  for (const variable of manifest.variables) {
    const providedValue = coerceValue(variable, provided[variable.name]);
    const computed = computedValue(variable, values);
    const fallback = coerceValue(variable, variable.defaultValue);
    const resolved = providedValue ?? computed ?? fallback;

    if (resolved === undefined) {
      if (variable.required) {
        errors.push(`Missing required variable "${variable.name}"`);
      }
      continue;
    }

    if (!validateEnum(variable, resolved)) {
      errors.push(`Variable "${variable.name}" must be one of: ${variable.enumValues?.join(', ')}`);
      continue;
    }

    values[variable.name] = resolved;
  }

  return {
    values,
    errors
  };
}

export function renderTemplate(
  manifest: TemplateManifest,
  values: Record<string, unknown>
): RenderedTemplate {
  const resolved = resolveTemplateVariables(manifest, values);
  if (resolved.errors.length > 0) {
    throw new Error(`Template variable resolution failed: ${resolved.errors.join('; ')}`);
  }

  let output = manifest.content;
  for (const [name, value] of Object.entries(resolved.values)) {
    output = output.replaceAll(`{{${name}}}`, String(value));
  }

  return {
    content: output,
    values: resolved.values
  };
}
