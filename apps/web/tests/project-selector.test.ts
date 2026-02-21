import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../src/runtime/apiClient.js';

describe('project-selector api scoping', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests run list scoped to selected project', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: []
        }),
        { status: 200 }
      )
    );

    const client = createApiClient('http://localhost:3100', { role: 'viewer' });
    await client.getRuns({ projectId: 'alpha' });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/runs?projectId=alpha', expect.any(Object));
  });
});
