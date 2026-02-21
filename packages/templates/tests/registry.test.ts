import { describe, expect, it } from 'vitest';
import { TemplateRegistry, parseTemplateManifest } from '../src/registry.js';

describe('template registry', () => {
  it('parses and registers template manifest', () => {
    const manifest = parseTemplateManifest(
      'base.yaml',
      `
id: base
title: Base Template
content: "Hello {{name}}"
variables:
  - name: name
    type: string
    required: true
`
    );

    const registry = new TemplateRegistry();
    registry.register({ manifest, source: 'base.yaml' });

    expect(registry.listIds()).toEqual(['base']);
    expect(registry.get('base').title).toBe('Base Template');
  });

  it('fails on duplicate variable names', () => {
    expect(() =>
      parseTemplateManifest(
        'dup.yaml',
        `
id: duplicate
title: Duplicate
content: "x"
variables:
  - name: value
    type: string
  - name: value
    type: string
`
      )
    ).toThrow('Duplicate variable "value"');
  });

  it('fails for malformed template source', () => {
    expect(() => parseTemplateManifest('bad.yaml', 'id: test\ntitle: bad\ncontent: [')).toThrow(
      'Template parsing failed'
    );
  });
});
