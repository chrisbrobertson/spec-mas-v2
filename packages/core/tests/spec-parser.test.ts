import { describe, expect, it } from 'vitest';
import {
  listSpecSections,
  parseSpecDocument,
  parseSpecFrontMatter,
  validateRequiredSections,
  validateSpecFrontMatter
} from '../src/specParser.js';

const VALID_SPEC = `---
specmas: v4
kind: FeatureSpec
id: feature-a
name: Feature A
version: 1.0.0
complexity: MODERATE
maturity: 2
---
# Feature A

## Overview
This is the overview.

## Functional Requirements
- FR-1

## Acceptance Criteria
- AC-1
`;

describe('spec parser', () => {
  it('parses valid spec with required sections', () => {
    const parsed = parseSpecDocument(VALID_SPEC);

    expect(parsed.frontMatter.id).toBe('feature-a');
    expect(parsed.frontMatter.name).toBe('Feature A');
    expect(parsed.frontMatter.complexity).toBe('MODERATE');
    expect(parsed.frontMatter.maturity).toBe(2);
    expect(parsed.sections).toContain('Overview');
    expect(parsed.sections).toContain('Functional Requirements');
    expect(parsed.body).toContain('# Feature A');
  });

  it('parses front matter and sections independently', () => {
    const frontMatter = parseSpecFrontMatter(VALID_SPEC);
    const sections = listSpecSections(VALID_SPEC);

    expect(frontMatter.version).toBe('1.0.0');
    expect(sections).toEqual(['Overview', 'Functional Requirements', 'Acceptance Criteria']);
  });

  it('fails when front matter block is missing', () => {
    expect(() => parseSpecDocument('# no front matter')).toThrow('Missing front matter block');
  });

  it('fails for invalid yaml front matter', () => {
    expect(() =>
      parseSpecDocument(`---
specmas: v4
id feature-a
---
## Overview
## Functional Requirements
## Acceptance Criteria`)
    ).toThrow('Invalid YAML front matter');
  });

  it('fails when required front-matter fields are missing', () => {
    expect(() =>
      parseSpecDocument(`---
specmas: v4
kind: FeatureSpec
id: feature-a
name: Feature A
version: 1.0.0
maturity: 2
---
## Overview
## Functional Requirements
## Acceptance Criteria`)
    ).toThrow('Invalid front matter: complexity Required');
  });

  it('fails when required section is missing', () => {
    expect(() =>
      parseSpecDocument(`---
specmas: v4
kind: FeatureSpec
id: feature-a
name: Feature A
version: 1.0.0
complexity: EASY
maturity: 1
---
## Overview
## Functional Requirements
- fr1`)
    ).toThrow('Missing required section: Acceptance Criteria');
  });

  it('fails on invalid front matter values and section validation', () => {
    expect(() =>
      validateSpecFrontMatter({
        specmas: 'v4',
        kind: 'FeatureSpec',
        id: 'feature-a',
        name: 'Feature A',
        version: '1.0.0',
        complexity: 'IMPOSSIBLE',
        maturity: 7
      })
    ).toThrow('Invalid front matter: complexity');

    expect(() => validateRequiredSections(['Overview'])).toThrow(
      'Missing required section: Functional Requirements'
    );
  });

  it('handles UTF-8 BOM and CRLF line endings', () => {
    const documentWithBomAndCrlf =
      '\uFEFF---\r\nspecmas: v4\r\nkind: FeatureSpec\r\nid: feature-b\r\nname: Feature B\r\nversion: 2.0.0\r\ncomplexity: HIGH\r\nmaturity: 4\r\n---\r\n## Overview\r\n## Functional Requirements\r\n## Acceptance Criteria\r\n';

    const parsed = parseSpecDocument(documentWithBomAndCrlf);
    expect(parsed.frontMatter.id).toBe('feature-b');
    expect(parsed.sections).toEqual(['Overview', 'Functional Requirements', 'Acceptance Criteria']);
  });
});
