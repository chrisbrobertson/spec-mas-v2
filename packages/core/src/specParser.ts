import { z } from 'zod';
import { parseDocument } from 'yaml';

export interface ParsedSpec {
  frontMatter: SpecFrontMatter;
  sections: string[];
  body: string;
}

const FrontMatterSchema = z
  .object({
    specmas: z.union([z.string(), z.number()]).transform((value) => String(value)),
    kind: z.string().min(1),
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.union([z.string(), z.number()]).transform((value) => String(value)),
    complexity: z.enum(['EASY', 'MODERATE', 'HIGH']),
    maturity: z.preprocess(
      (value) => (typeof value === 'string' ? Number.parseInt(value, 10) : value),
      z.number().int().min(1).max(4)
    )
  })
  .passthrough();

export type SpecFrontMatter = z.infer<typeof FrontMatterSchema>;

export const REQUIRED_FRONT_MATTER_FIELDS = [
  'specmas',
  'kind',
  'id',
  'name',
  'version',
  'complexity',
  'maturity'
] as const;
export const REQUIRED_SECTIONS = ['Overview', 'Functional Requirements', 'Acceptance Criteria'] as const;

function splitFrontMatter(markdown: string): { frontMatterBlock: string; body: string } {
  const normalized = markdown.startsWith('\uFEFF') ? markdown.slice(1) : markdown;
  const lines = normalized.split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    throw new Error('Missing front matter block');
  }

  let delimiterIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      delimiterIndex = index;
      break;
    }
  }

  if (delimiterIndex < 0) {
    throw new Error('Unterminated front matter block');
  }

  return {
    frontMatterBlock: lines.slice(1, delimiterIndex).join('\n'),
    body: lines.slice(delimiterIndex + 1).join('\n')
  };
}

function parseFrontMatterBlock(block: string): Record<string, unknown> {
  const document = parseDocument(block);
  if (document.errors.length > 0) {
    throw new Error(`Invalid YAML front matter: ${document.errors[0].message}`);
  }

  const value = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Front matter must be a YAML mapping');
  }

  return value as Record<string, unknown>;
}

export function validateSpecFrontMatter(frontMatter: Record<string, unknown>): SpecFrontMatter {
  const parsed = FrontMatterSchema.safeParse(frontMatter);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
    throw new Error(`Invalid front matter: ${path} ${issue.message}`);
  }

  return parsed.data;
}

function extractSections(markdown: string): string[] {
  const sections: string[] = [];
  const sectionPattern = /^##\s+(.+?)\s*$/gm;
  let match: RegExpExecArray | null = null;
  while ((match = sectionPattern.exec(markdown)) !== null) {
    const sectionName = match[1].trim();
    if (!sectionName) {
      continue;
    }
    sections.push(sectionName);
  }
  return sections;
}

export function validateRequiredSections(sections: string[]): void {
  for (const requiredSection of REQUIRED_SECTIONS) {
    if (!sections.includes(requiredSection)) {
      throw new Error(`Missing required section: ${requiredSection}`);
    }
  }
}

export function parseSpecDocument(markdown: string): ParsedSpec {
  const { frontMatterBlock, body } = splitFrontMatter(markdown);
  const frontMatter = validateSpecFrontMatter(parseFrontMatterBlock(frontMatterBlock));
  const sections = extractSections(body);
  validateRequiredSections(sections);

  return { frontMatter, sections, body };
}

export function parseSpecFrontMatter(markdown: string): SpecFrontMatter {
  const { frontMatterBlock } = splitFrontMatter(markdown);
  return validateSpecFrontMatter(parseFrontMatterBlock(frontMatterBlock));
}

export function listSpecSections(markdown: string): string[] {
  const { body } = splitFrontMatter(markdown);
  return extractSections(body);
}
