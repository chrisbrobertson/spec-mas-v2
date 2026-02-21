import { describe, expect, it } from 'vitest';
import { classifyFailure, nextRecoveryAction } from '../src/recovery.js';

describe('recovery state machine', () => {
  it('classifies failure types', () => {
    expect(classifyFailure(new Error('Timeout exceeded'))).toBe('timeout');
    expect(classifyFailure(new Error('Sandbox networking denied'))).toBe('sandbox_error');
  });

  it('prioritizes restart for sandbox errors', () => {
    const policy = { maxRetries: 2, maxRestarts: 1, allowFallback: false };

    expect(nextRecoveryAction('sandbox_error', { retriesUsed: 0, restartsUsed: 0 }, policy)).toBe(
      'restart'
    );
  });

  it('selects retry then restart then fallback', () => {
    const policy = { maxRetries: 1, maxRestarts: 1, allowFallback: true };

    expect(nextRecoveryAction('timeout', { retriesUsed: 0, restartsUsed: 0 }, policy)).toBe('retry');
    expect(nextRecoveryAction('timeout', { retriesUsed: 1, restartsUsed: 0 }, policy)).toBe('restart');
    expect(nextRecoveryAction('timeout', { retriesUsed: 1, restartsUsed: 1 }, policy)).toBe('fallback');
  });

  it('rejects invalid policy values', () => {
    expect(() =>
      nextRecoveryAction(
        'timeout',
        { retriesUsed: 0, restartsUsed: 0 },
        { maxRetries: -1, maxRestarts: 0, allowFallback: false }
      )
    ).toThrow('Recovery policy limits must be non-negative');
  });
});
