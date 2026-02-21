import { describe, expect, it } from 'vitest';
import { renderPrSummary } from '../src/summaryReporter.js';

describe('pr summary reporter', () => {
  it('renders successful summary markdown', () => {
    const output = renderPrSummary({
      workflow: 'validate',
      status: 'success',
      checks: [
        { name: 'lint', status: 'pass' },
        { name: 'typecheck', status: 'pass' }
      ]
    });

    expect(output).toContain('## ✅ validate pipeline');
    expect(output).toContain('- ✅ lint');
  });

  it('renders failing checks with details', () => {
    const output = renderPrSummary({
      workflow: 'run',
      status: 'failure',
      checks: [{ name: 'integration', status: 'fail', details: '1 test failed' }]
    });

    expect(output).toContain('## ❌ run pipeline');
    expect(output).toContain('1 test failed');
  });
});
