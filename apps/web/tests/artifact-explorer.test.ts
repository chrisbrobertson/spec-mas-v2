import { describe, expect, it } from 'vitest';
import { buildArtifactTree, renderArtifactPreview, selectArtifactRenderer } from '../src/artifactExplorer.js';

describe('artifact-explorer', () => {
  it('builds deterministic tree and renderer summaries', () => {
    const tree = buildArtifactTree([
      'validation/gate-results.json',
      'run-summary.md',
      'phases/test/coverage-report.html'
    ]);

    expect(tree.children.map((node) => node.name)).toEqual(['phases', 'validation', 'run-summary.md']);
    expect(tree.children[0].children[0].children[0].path).toBe('phases/test/coverage-report.html');

    expect(selectArtifactRenderer('run-summary.md')).toBe('markdown');
    expect(selectArtifactRenderer('validation/gate-results.json')).toBe('json');
    expect(selectArtifactRenderer('validation/gate-results.sarif')).toBe('sarif');
    expect(selectArtifactRenderer('changes.patch')).toBe('diff');
    expect(selectArtifactRenderer('coverage-report.html')).toBe('html');
  });

  it('falls back to text preview on unparseable structured content', () => {
    const preview = renderArtifactPreview('validation/gate-results.json', '{broken');

    expect(preview).toEqual({
      renderer: 'text',
      summary: 'Unparseable structured content'
    });
  });

  it('handles edge case with empty artifact path list', () => {
    const tree = buildArtifactTree(['', '   ']);

    expect(tree.name).toBe('root');
    expect(tree.children).toEqual([]);
    expect(renderArtifactPreview('run-summary.md', '# Summary')).toEqual({
      renderer: 'markdown',
      summary: '# Summary'
    });
  });
});
