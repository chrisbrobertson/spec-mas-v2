import { describe, expect, it } from 'vitest';
import { resolveSecrets } from '../src/secrets.js';

describe('secrets resolution', () => {
  it('resolves env-backed secrets', () => {
    const secrets = resolveSecrets(
      {
        API_KEY: { provider: 'env', key: 'API_KEY', required: true }
      },
      {
        env: { API_KEY: 'abc123' }
      }
    );

    expect(secrets.API_KEY).toBe('abc123');
  });

  it('throws for missing required secret', () => {
    expect(() =>
      resolveSecrets(
        {
          API_KEY: { provider: 'env', key: 'API_KEY', required: true }
        },
        {
          env: {}
        }
      )
    ).toThrow('Missing required secret: API_KEY');
  });
});
