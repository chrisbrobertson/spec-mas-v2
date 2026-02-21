import { describe, expect, it } from 'vitest';
import type { RuntimeAdapter } from '../src/contracts.js';
import { createLocalDockerOpenHandsRuntimeAdapter } from '../src/openhandsAdapter.js';

describe('runtime adapter contract', () => {
  it('is satisfied by the real local docker OpenHands adapter', () => {
    const adapter: RuntimeAdapter = createLocalDockerOpenHandsRuntimeAdapter();

    expect(typeof adapter.provision).toBe('function');
    expect(typeof adapter.execute).toBe('function');
    expect(typeof adapter.stream).toBe('function');
    expect(typeof adapter.teardown).toBe('function');
  });
});
