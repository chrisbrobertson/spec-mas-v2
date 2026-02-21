export interface AccessRequest {
  activeProjectId: string;
  targetProjectId: string;
  activeWorkspaceRoot: string;
  targetWorkspaceRoot: string;
  targetRelativePath?: string;
}

function normalizeRoot(root: string): string {
  return root.replace(/\/+$/, '');
}

export function assertProjectIsolation(request: AccessRequest): void {
  if (request.activeProjectId !== request.targetProjectId) {
    throw new Error(
      `Cross-project access denied: ${request.activeProjectId} -> ${request.targetProjectId}`
    );
  }

  const activeRoot = normalizeRoot(request.activeWorkspaceRoot);
  const targetRoot = normalizeRoot(request.targetWorkspaceRoot);

  if (activeRoot !== targetRoot) {
    throw new Error('Workspace root mismatch for same project request');
  }

  if (request.targetRelativePath?.includes('..')) {
    throw new Error('Path traversal outside workspace is not allowed');
  }
}
