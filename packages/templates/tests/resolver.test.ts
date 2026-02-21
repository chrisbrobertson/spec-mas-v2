import { describe, expect, it } from 'vitest';
import { renderTemplate, resolveTemplateVariables } from '../src/resolver.js';
import type { TemplateManifest } from '../src/registry.js';

const manifest: TemplateManifest = {
  id: 'example',
  title: 'Example',
  content: 'Name={{name}}; Env={{env}}; Full={{fullName}}',
  variables: [
    { name: 'name', type: 'string', required: true },
    { name: 'env', type: 'string', defaultValue: 'dev', enumValues: ['dev', 'prod'] },
    {
      name: 'fullName',
      type: 'string',
      computed: { op: 'concat', parts: ['user:', '$name'] }
    }
  ]
};

describe('template variable resolver', () => {
  it('resolves required, default, and computed variables', () => {
    const result = resolveTemplateVariables(manifest, { name: 'alice' });
    expect(result.errors).toEqual([]);
    expect(result.values).toEqual({
      name: 'alice',
      env: 'dev',
      fullName: 'user:alice'
    });
  });

  it('returns validation errors for missing required and enum mismatch', () => {
    const result = resolveTemplateVariables(manifest, { env: 'qa' });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing required variable "name"',
        'Variable "env" must be one of: dev, prod'
      ])
    );
  });

  it('renders template with resolved values', () => {
    const output = renderTemplate(manifest, { name: 'bob', env: 'prod' });
    expect(output.content).toBe('Name=bob; Env=prod; Full=user:bob');
  });
});
