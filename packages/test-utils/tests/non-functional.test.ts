import { describe, expect, it } from 'vitest';
import { evaluateNonFunctionalBudget } from '../src/nonFunctional.js';

describe('non-functional regression suite', () => {
  it('passes when metrics stay within budget', () => {
    const result = evaluateNonFunctionalBudget(
      {
        durationMs: 500,
        errorRate: 0.01,
        isolationBreaches: 0
      },
      {
        maxDurationMs: 1000,
        maxErrorRate: 0.05,
        maxIsolationBreaches: 0
      }
    );

    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when reliability budget is exceeded', () => {
    const result = evaluateNonFunctionalBudget(
      {
        durationMs: 1200,
        errorRate: 0.01,
        isolationBreaches: 0
      },
      {
        maxDurationMs: 1000,
        maxErrorRate: 0.05,
        maxIsolationBreaches: 0
      }
    );

    expect(result.pass).toBe(false);
    expect(result.violations[0]).toContain('duration exceeded budget');
  });

  it('fails when security isolation breaches occur', () => {
    const result = evaluateNonFunctionalBudget(
      {
        durationMs: 500,
        errorRate: 0,
        isolationBreaches: 1
      },
      {
        maxDurationMs: 1000,
        maxErrorRate: 0.05,
        maxIsolationBreaches: 0
      }
    );

    expect(result.pass).toBe(false);
    expect(result.violations[0]).toContain('isolation breaches exceeded budget');
  });
});
