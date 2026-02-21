import YAML from 'yaml';

export type TemplateVariableType = 'string' | 'number' | 'boolean';

export interface ComputedVariableConfig {
  op: 'concat';
  parts: string[];
}

export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  enumValues?: Array<string | number | boolean>;
  computed?: ComputedVariableConfig;
}

export interface TemplateManifest {
  id: string;
  title: string;
  content: string;
  variables: TemplateVariable[];
}

export interface TemplateRegistryEntry {
  manifest: TemplateManifest;
  source: string;
}

function normalizeVariable(variable: TemplateVariable): TemplateVariable {
  if (!variable.name?.trim()) {
    throw new Error('Template variable name is required');
  }
  if (!['string', 'number', 'boolean'].includes(variable.type)) {
    throw new Error(`Unsupported variable type for "${variable.name}"`);
  }
  return {
    ...variable,
    name: variable.name.trim()
  };
}

export function parseTemplateManifest(source: string, raw: string): TemplateManifest {
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Template parsing failed for ${source}: ${(error as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Template ${source} must be an object`);
  }

  const record = parsed as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const content = typeof record.content === 'string' ? record.content : '';

  if (!id) {
    throw new Error(`Template ${source} missing id`);
  }
  if (!title) {
    throw new Error(`Template ${source} missing title`);
  }
  if (!content) {
    throw new Error(`Template ${source} missing content`);
  }

  const variables = Array.isArray(record.variables)
    ? record.variables.map((variable) => normalizeVariable(variable as TemplateVariable))
    : [];

  const names = new Set<string>();
  for (const variable of variables) {
    if (names.has(variable.name)) {
      throw new Error(`Duplicate variable "${variable.name}" in template ${id}`);
    }
    names.add(variable.name);
  }

  return {
    id,
    title,
    content,
    variables
  };
}

export class TemplateRegistry {
  private readonly entries = new Map<string, TemplateRegistryEntry>();

  register(entry: TemplateRegistryEntry): void {
    if (this.entries.has(entry.manifest.id)) {
      throw new Error(`Template "${entry.manifest.id}" already exists`);
    }
    this.entries.set(entry.manifest.id, entry);
  }

  get(templateId: string): TemplateManifest {
    const entry = this.entries.get(templateId);
    if (!entry) {
      throw new Error(`Template "${templateId}" was not found`);
    }
    return entry.manifest;
  }

  listIds(): string[] {
    return [...this.entries.keys()].sort();
  }
}
