import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEST_FILE_PATTERNS = [
  /^apps\/[^/]+\/tests\/[^/]+\.test\.ts$/,
  /^packages\/[^/]+\/tests\/[^/]+\.test\.ts$/
];

const DEFAULT_MIN_NEGATIVE_PATH_RATIO = 0.2;

const FOCUSED_OR_SKIPPED_PATTERNS: ReadonlyArray<{
  source: string;
  expression: RegExp;
  remediation: string;
}> = [
  {
    source: 'describe/context/suite/it/test.only',
    expression: /\b(?:describe|context|suite|it|test)\.only\s*\(/g,
    remediation: 'Replace focused tests with normal test declarations.'
  },
  {
    source: 'describe/context/suite/it/test.skip',
    expression: /\b(?:describe|context|suite|it|test)\.skip\s*\(/g,
    remediation: 'Remove skips and convert to active tests.'
  },
  {
    source: 'fit/fdescribe/xit/xtest',
    expression: /\b(?:fit|fdescribe|xit|xtest)\s*\(/g,
    remediation: 'Replace aliases with `it`/`describe` and active coverage.'
  }
];

const TEST_TITLE_PATTERN = /\b(?:it|test)\s*\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,/g;
const EMPTY_ARROW_TEST_BODY_PATTERN =
  /\b(?:it|test)\s*\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*\{\s*\}\s*\)/g;
const EMPTY_FUNCTION_TEST_BODY_PATTERN =
  /\b(?:it|test)\s*\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1\s*,\s*(?:async\s*)?function(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?\s*\([^)]*\)\s*\{\s*\}\s*\)/g;

const NEGATIVE_PATH_TITLE_PATTERN =
  /\b(fail(?:s|ed|ure)?|error(?:s)?|invalid|reject(?:s|ed|ion)?|deny|denies|denied|missing|not\s+found|illegal|unsupported|cannot|can't|without|unhealthy|throws?|throw|blocked|mismatch|exceed(?:s|ed)?|timeout)\b/i;

export type TestQualityRuleId =
  | 'focused-or-skipped'
  | 'empty-test-body'
  | 'duplicate-title'
  | 'negative-path-ratio'
  | 'no-test-files';

export interface TestQualityViolation {
  ruleId: TestQualityRuleId;
  message: string;
  filePath?: string;
  line?: number;
}

export interface TestQualityAuditOptions {
  rootDir: string;
  minNegativePathRatio?: number;
}

export interface TestQualityAuditResult {
  ok: boolean;
  filesScanned: number;
  testCaseCount: number;
  negativePathTitleCount: number;
  negativePathRatio: number;
  minNegativePathRatio: number;
  violations: TestQualityViolation[];
}

interface TestTitleOccurrence {
  title: string;
  normalizedTitle: string;
  line: number;
}

function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function lineAtIndex(source: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

function compareViolations(left: TestQualityViolation, right: TestQualityViolation): number {
  const leftPath = left.filePath ?? '{repository}';
  const rightPath = right.filePath ?? '{repository}';
  if (leftPath !== rightPath) {
    return leftPath.localeCompare(rightPath);
  }

  const leftLine = left.line ?? Number.MAX_SAFE_INTEGER;
  const rightLine = right.line ?? Number.MAX_SAFE_INTEGER;
  if (leftLine !== rightLine) {
    return leftLine - rightLine;
  }

  if (left.ruleId !== right.ruleId) {
    return left.ruleId.localeCompare(right.ruleId);
  }
  return left.message.localeCompare(right.message);
}

async function walkRelative(rootDir: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = join(rootDir, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const discovered: string[] = [];

  for (const entry of sortedEntries) {
    const entryRelative = toPosixPath(join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      const nested = await walkRelative(rootDir, entryRelative);
      discovered.push(...nested);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (TEST_FILE_PATTERNS.some((pattern) => pattern.test(entryRelative))) {
      discovered.push(entryRelative);
    }
  }

  return discovered;
}

async function discoverTestFiles(rootDir: string): Promise<string[]> {
  const files: string[] = [];
  for (const rootSegment of ['apps', 'packages']) {
    try {
      const discovered = await walkRelative(rootDir, rootSegment);
      files.push(...discovered);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function extractTitleOccurrences(source: string): TestTitleOccurrence[] {
  const matches: TestTitleOccurrence[] = [];
  TEST_TITLE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TEST_TITLE_PATTERN.exec(source);
  while (match) {
    const rawTitle = match[2] ?? '';
    matches.push({
      title: rawTitle,
      normalizedTitle: normalizeTitle(rawTitle),
      line: lineAtIndex(source, match.index)
    });
    match = TEST_TITLE_PATTERN.exec(source);
  }
  return matches;
}

function pushFocusedOrSkippedViolations(
  source: string,
  filePath: string,
  violations: TestQualityViolation[]
): void {
  for (const pattern of FOCUSED_OR_SKIPPED_PATTERNS) {
    pattern.expression.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.expression.exec(source);
    while (match) {
      violations.push({
        ruleId: 'focused-or-skipped',
        filePath,
        line: lineAtIndex(source, match.index),
        message: `Found ${pattern.source} pattern "${match[0].trim()}". ${pattern.remediation}`
      });
      match = pattern.expression.exec(source);
    }
  }
}

function pushEmptyBodyViolations(
  source: string,
  filePath: string,
  violations: TestQualityViolation[]
): void {
  const emptyMatches = new Map<number, string>();

  EMPTY_ARROW_TEST_BODY_PATTERN.lastIndex = 0;
  let arrowMatch: RegExpExecArray | null = EMPTY_ARROW_TEST_BODY_PATTERN.exec(source);
  while (arrowMatch) {
    emptyMatches.set(arrowMatch.index, arrowMatch[2] ?? '');
    arrowMatch = EMPTY_ARROW_TEST_BODY_PATTERN.exec(source);
  }

  EMPTY_FUNCTION_TEST_BODY_PATTERN.lastIndex = 0;
  let functionMatch: RegExpExecArray | null = EMPTY_FUNCTION_TEST_BODY_PATTERN.exec(source);
  while (functionMatch) {
    emptyMatches.set(functionMatch.index, functionMatch[2] ?? '');
    functionMatch = EMPTY_FUNCTION_TEST_BODY_PATTERN.exec(source);
  }

  for (const [index, title] of [...emptyMatches.entries()].sort((left, right) => left[0] - right[0])) {
    violations.push({
      ruleId: 'empty-test-body',
      filePath,
      line: lineAtIndex(source, index),
      message: `Test "${normalizeTitle(title)}" has an empty body. Add meaningful assertions or remove the test.`
    });
  }
}

function pushDuplicateTitleViolations(
  titleOccurrences: readonly TestTitleOccurrence[],
  filePath: string,
  violations: TestQualityViolation[]
): void {
  const duplicates = new Map<string, number[]>();

  for (const occurrence of titleOccurrences) {
    const existing = duplicates.get(occurrence.normalizedTitle) ?? [];
    existing.push(occurrence.line);
    duplicates.set(occurrence.normalizedTitle, existing);
  }

  for (const [title, lines] of [...duplicates.entries()].sort((left, right) =>
    left[0].localeCompare(right[0])
  )) {
    if (lines.length < 2) {
      continue;
    }

    violations.push({
      ruleId: 'duplicate-title',
      filePath,
      line: lines[0],
      message: `Duplicate test title "${title}" appears on lines ${lines.join(', ')}. Rename titles to keep scenarios distinct.`
    });
  }
}

function pushGlobalViolations(
  testCaseCount: number,
  negativePathTitleCount: number,
  minNegativePathRatio: number,
  violations: TestQualityViolation[]
): number {
  const ratio = testCaseCount === 0 ? 0 : negativePathTitleCount / testCaseCount;

  if (testCaseCount === 0) {
    violations.push({
      ruleId: 'no-test-files',
      message:
        'No matching test files were discovered under apps/**/tests/*.test.ts and packages/**/tests/*.test.ts.'
    });
    return ratio;
  }

  if (ratio < minNegativePathRatio) {
    const actualPercent = (ratio * 100).toFixed(1);
    const requiredPercent = (minNegativePathRatio * 100).toFixed(1);
    violations.push({
      ruleId: 'negative-path-ratio',
      message: `Negative-path title ratio is ${actualPercent}% (${negativePathTitleCount}/${testCaseCount}), below required ${requiredPercent}%. Add explicit negative-path tests (for example: "fails", "rejects", "invalid", "missing").`
    });
  }

  return ratio;
}

export async function auditRepositoryTestQuality(
  options: TestQualityAuditOptions
): Promise<TestQualityAuditResult> {
  const minNegativePathRatio = options.minNegativePathRatio ?? DEFAULT_MIN_NEGATIVE_PATH_RATIO;
  if (minNegativePathRatio < 0 || minNegativePathRatio > 1) {
    throw new Error('minNegativePathRatio must be between 0 and 1');
  }

  const files = await discoverTestFiles(options.rootDir);
  const violations: TestQualityViolation[] = [];
  const allTitles: string[] = [];

  for (const filePath of files) {
    const source = await readFile(join(options.rootDir, filePath), 'utf8');
    pushFocusedOrSkippedViolations(source, filePath, violations);
    pushEmptyBodyViolations(source, filePath, violations);

    const titleOccurrences = extractTitleOccurrences(source);
    pushDuplicateTitleViolations(titleOccurrences, filePath, violations);
    allTitles.push(...titleOccurrences.map((title) => title.title));
  }

  const testCaseCount = allTitles.length;
  const negativePathTitleCount = allTitles.filter((title) =>
    NEGATIVE_PATH_TITLE_PATTERN.test(normalizeTitle(title))
  ).length;
  const negativePathRatio = pushGlobalViolations(
    testCaseCount,
    negativePathTitleCount,
    minNegativePathRatio,
    violations
  );

  const orderedViolations = [...violations].sort(compareViolations);

  return {
    ok: orderedViolations.length === 0,
    filesScanned: files.length,
    testCaseCount,
    negativePathTitleCount,
    negativePathRatio,
    minNegativePathRatio,
    violations: orderedViolations
  };
}

export function formatTestQualityAuditFailure(result: TestQualityAuditResult): string {
  if (result.ok) {
    return `Test quality audit passed (${result.filesScanned} files, ${result.testCaseCount} test cases).`;
  }

  const actualPercent = (result.negativePathRatio * 100).toFixed(1);
  const requiredPercent = (result.minNegativePathRatio * 100).toFixed(1);
  const lines: string[] = [
    `Test quality audit failed with ${result.violations.length} issue(s).`,
    `Scanned ${result.filesScanned} files and ${result.testCaseCount} test cases.`,
    `Negative-path coverage ratio: ${actualPercent}% (${result.negativePathTitleCount}/${result.testCaseCount}), required >= ${requiredPercent}%.`
  ];

  result.violations.forEach((violation, index) => {
    const location = violation.filePath
      ? `${violation.filePath}${violation.line ? `:${violation.line}` : ''}`
      : 'repository';
    lines.push(`${index + 1}. [${violation.ruleId}] ${location} - ${violation.message}`);
  });

  return lines.join('\n');
}
