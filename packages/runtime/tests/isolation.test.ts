import { describe, expect, it } from 'vitest';
import { assertProjectIsolation } from '../src/isolation.js';

describe('project isolation guard', () => {
  it('allows same project and workspace root', () => {
    expect(() =>
      assertProjectIsolation({
        activeProjectId: 'p1',
        targetProjectId: 'p1',
        activeWorkspaceRoot: '/repo/a',
        targetWorkspaceRoot: '/repo/a'
      })
    ).not.toThrow();
  });

  it('blocks cross-project access', () => {
    expect(() =>
      assertProjectIsolation({
        activeProjectId: 'p1',
        targetProjectId: 'p2',
        activeWorkspaceRoot: '/repo/a',
        targetWorkspaceRoot: '/repo/b'
      })
    ).toThrow('Cross-project access denied: p1 -> p2');
  });

  it('allows same root with trailing slash differences', () => {
    expect(() =>
      assertProjectIsolation({
        activeProjectId: 'p1',
        targetProjectId: 'p1',
        activeWorkspaceRoot: '/repo/a/',
        targetWorkspaceRoot: '/repo/a'
      })
    ).not.toThrow();
  });

  it('blocks path traversal in relative target path', () => {
    expect(() =>
      assertProjectIsolation({
        activeProjectId: 'p1',
        targetProjectId: 'p1',
        activeWorkspaceRoot: '/repo/a',
        targetWorkspaceRoot: '/repo/a',
        targetRelativePath: '../secret.txt'
      })
    ).toThrow('Path traversal outside workspace is not allowed');
  });
});
