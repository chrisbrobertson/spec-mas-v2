export type ArtifactRenderer = 'markdown' | 'json' | 'sarif' | 'diff' | 'html' | 'text';

export interface ArtifactNode {
  kind: 'directory' | 'file';
  name: string;
  path: string;
  children: ArtifactNode[];
}

export interface ArtifactPreview {
  renderer: ArtifactRenderer;
  summary: string;
}

function createDirectory(path: string, name: string): ArtifactNode {
  return {
    kind: 'directory',
    name,
    path,
    children: []
  };
}

function createFile(path: string, name: string): ArtifactNode {
  return {
    kind: 'file',
    name,
    path,
    children: []
  };
}

function sortNodes(nodes: ArtifactNode[]): ArtifactNode[] {
  return nodes.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function buildArtifactTree(paths: string[]): ArtifactNode {
  const root = createDirectory('', 'root');

  for (const path of [...paths].sort((left, right) => left.localeCompare(right))) {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      continue;
    }

    const segments = trimmedPath.split('/').filter((segment) => segment.length > 0);
    let current = root;
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      let child = current.children.find((candidate) => candidate.name === segment);
      if (!child) {
        child = isFile ? createFile(currentPath, segment) : createDirectory(currentPath, segment);
        current.children.push(child);
      }

      if (!isFile && child.kind === 'file') {
        throw new Error(`Invalid artifact path hierarchy at ${currentPath}`);
      }

      current = child;
    });
  }

  const stack: ArtifactNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    node.children = sortNodes(node.children);
    stack.push(...node.children);
  }

  return root;
}

export function selectArtifactRenderer(artifactPath: string): ArtifactRenderer {
  const normalized = artifactPath.toLowerCase();

  if (normalized.endsWith('.md') || normalized.endsWith('.markdown')) {
    return 'markdown';
  }

  if (normalized.endsWith('.sarif')) {
    return 'sarif';
  }

  if (normalized.endsWith('.diff') || normalized.endsWith('.patch')) {
    return 'diff';
  }

  if (normalized.endsWith('.html') || normalized.endsWith('.htm')) {
    return 'html';
  }

  if (normalized.endsWith('.json')) {
    return 'json';
  }

  return 'text';
}

function summarizeMarkdown(content: string): string {
  const heading = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'));

  return heading ?? 'Markdown content';
}

function summarizeJson(content: string): string {
  const parsed = JSON.parse(content) as unknown;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return `JSON object with ${Object.keys(parsed).length} keys`;
  }

  if (Array.isArray(parsed)) {
    return `JSON array with ${parsed.length} items`;
  }

  return `JSON ${typeof parsed}`;
}

function summarizeSarif(content: string): string {
  const parsed = JSON.parse(content) as {
    runs?: Array<{ results?: unknown[] }>;
  };
  const runs = parsed.runs ?? [];
  const resultCount = runs.reduce((total, run) => total + (run.results?.length ?? 0), 0);
  return `SARIF runs=${runs.length} results=${resultCount}`;
}

function summarizeDiff(content: string): string {
  const added = content.split('\n').filter((line) => line.startsWith('+')).length;
  const removed = content.split('\n').filter((line) => line.startsWith('-')).length;
  return `Diff +${added} -${removed}`;
}

function summarizeHtml(content: string): string {
  const titleMatch = content.match(/<title>(.*?)<\/title>/i);
  return titleMatch ? `HTML title: ${titleMatch[1]}` : 'HTML document';
}

export function renderArtifactPreview(artifactPath: string, content: string): ArtifactPreview {
  const renderer = selectArtifactRenderer(artifactPath);

  try {
    switch (renderer) {
      case 'markdown':
        return { renderer, summary: summarizeMarkdown(content) };
      case 'json':
        return { renderer, summary: summarizeJson(content) };
      case 'sarif':
        return { renderer, summary: summarizeSarif(content) };
      case 'diff':
        return { renderer, summary: summarizeDiff(content) };
      case 'html':
        return { renderer, summary: summarizeHtml(content) };
      default:
        return { renderer, summary: `${content.length} characters` };
    }
  } catch {
    return {
      renderer: 'text',
      summary: 'Unparseable structured content'
    };
  }
}
