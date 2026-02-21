import { describe, expect, it } from 'vitest';
import { runIntegrationSmoke } from '../src/smoke.js';

describe('integration smoke suite', () => {
  it('passes when all probes pass', async () => {
    const result = await runIntegrationSmoke([
      { name: 'api', run: async () => ({ ok: true, details: 'healthy' }) },
      { name: 'cli', run: async () => ({ ok: true, details: 'ready' }) }
    ]);

    expect(result.ok).toBe(true);
    expect(result.probeResults).toHaveLength(2);
  });

  it('fails when one probe fails', async () => {
    const result = await runIntegrationSmoke([
      { name: 'api', run: async () => ({ ok: true, details: 'healthy' }) },
      { name: 'web', run: async () => ({ ok: false, details: 'timeout' }) }
    ]);

    expect(result.ok).toBe(false);
    expect(result.probeResults.find((probe) => !probe.ok)?.name).toBe('web');
  });
});
