import { describe, expect, it } from 'vitest';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '../src/runtime/config.js';

describe('runtime-config', () => {
  it('uses provided absolute api url on happy path', () => {
    expect(resolveApiBaseUrl('http://localhost:3200')).toBe('http://localhost:3200');
  });

  it('falls back to default when input is missing or invalid', () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl('not-a-url')).toBe(DEFAULT_API_BASE_URL);
  });

  it('trims whitespace and trailing slash edge cases', () => {
    expect(resolveApiBaseUrl('  http://localhost:3100/  ')).toBe('http://localhost:3100');
  });
});
