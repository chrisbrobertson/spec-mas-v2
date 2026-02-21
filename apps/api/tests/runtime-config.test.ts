import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_HOST,
  DEFAULT_API_PORT,
  DEFAULT_CORS_ORIGIN,
  resolveApiHost,
  resolveApiPort,
  resolveCorsOrigin
} from '../src/runtimeConfig.js';

describe('runtime-config', () => {
  it('parses cli and env ports on happy path', () => {
    expect(resolveApiPort(['--port', '3200'], undefined)).toBe(3200);
    expect(resolveApiPort(['--port=3300'], undefined)).toBe(3300);
    expect(resolveApiPort([], '3400')).toBe(3400);
  });

  it('falls back to default on invalid port inputs', () => {
    expect(resolveApiPort(['--port', '0'], undefined)).toBe(DEFAULT_API_PORT);
    expect(resolveApiPort(['--port=not-a-number'], undefined)).toBe(DEFAULT_API_PORT);
    expect(resolveApiPort([], '70000')).toBe(DEFAULT_API_PORT);
  });

  it('resolves host and cors origin with edge-case trimming', () => {
    expect(resolveApiHost(undefined)).toBe(DEFAULT_API_HOST);
    expect(resolveApiHost(' 127.0.0.1 ')).toBe('127.0.0.1');
    expect(resolveCorsOrigin(undefined)).toBe(DEFAULT_CORS_ORIGIN);
    expect(resolveCorsOrigin('  http://localhost:3001  ')).toBe('http://localhost:3001');
  });
});
