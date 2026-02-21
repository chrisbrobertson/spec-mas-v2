import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/runtime/apiClient.js';

describe('branch-selector api scoping', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests run list scoped to selected branch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: []
        }),
        { status: 200 }
      )
    );

    const client = createApiClient('http://localhost:3100', { role: 'viewer' });
    await client.getRuns({ projectId: 'alpha', branch: 'specmas/run-2/issue-201' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3100/runs?projectId=alpha&branch=specmas%2Frun-2%2Fissue-201',
      expect.any(Object)
    );
  });
});
