import { describe, expect, it } from 'vitest';
import { evaluateAdversarialFindings } from '../src/adversarial.js';

describe('adversarial review thresholds', () => {
  it('passes when findings are within thresholds', () => {
    const result = evaluateAdversarialFindings(
      [
        { id: 'f1', severity: 'low', summary: 'minor' },
        { id: 'f2', severity: 'medium', summary: 'moderate' }
      ],
      {
        maxLow: 2,
        maxMedium: 2,
        maxHigh: 0,
        maxCritical: 0
      }
    );

    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when high severity threshold is exceeded', () => {
    const result = evaluateAdversarialFindings(
      [{ id: 'f1', severity: 'high', summary: 'major bug' }],
      {
        maxLow: 10,
        maxMedium: 10,
        maxHigh: 0,
        maxCritical: 0
      }
    );

    expect(result.pass).toBe(false);
    expect(result.violations[0]).toContain('high findings exceed threshold');
  });

  it('tracks critical findings counts deterministically', () => {
    const result = evaluateAdversarialFindings(
      [
        { id: 'f1', severity: 'critical', summary: 'p0' },
        { id: 'f2', severity: 'critical', summary: 'p0' }
      ],
      {
        maxLow: 10,
        maxMedium: 10,
        maxHigh: 10,
        maxCritical: 1
      }
    );

    expect(result.counts.critical).toBe(2);
    expect(result.pass).toBe(false);
  });
});
