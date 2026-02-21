import { describe, expect, it } from 'vitest';
import { applyMergeApprovalAction, runGateSet } from '../src/gates.js';

describe('gate runner', () => {
  it('passes when all required gates pass', () => {
    const result = runGateSet(['G1', 'G2', 'G3', 'G4'], {
      structurePass: true,
      semanticsPass: true,
      traceabilityPass: true,
      determinismPass: true
    });

    expect(result.passed).toBe(true);
    expect(result.findings).toHaveLength(4);
  });

  it('fails when any required gate fails', () => {
    const result = runGateSet(['G1', 'G2'], {
      structurePass: true,
      semanticsPass: false,
      traceabilityPass: true,
      determinismPass: true
    });

    expect(result.passed).toBe(false);
    expect(result.findings.find((finding) => finding.gateId === 'G2')?.passed).toBe(false);
  });

  it('reports unknown gate ids', () => {
    const result = runGateSet(['G1', 'CUSTOM'], {
      structurePass: true,
      semanticsPass: true,
      traceabilityPass: true,
      determinismPass: true
    });

    expect(result.passed).toBe(false);
    expect(result.findings.find((finding) => finding.gateId === 'CUSTOM')?.message).toContain(
      'Unknown gate'
    );
  });

  it('enforces merge approval state transitions', () => {
    const approved = applyMergeApprovalAction(
      {
        runId: 'run-1',
        status: 'awaiting_human_approval',
        updatedAt: '2026-02-21T00:00:00.000Z'
      },
      'approve'
    );
    expect(approved.status).toBe('approved');

    const merged = applyMergeApprovalAction(approved, 'merge');
    expect(merged.status).toBe('merged');

    expect(() => applyMergeApprovalAction(merged, 'approve')).toThrow('invalid merge transition: merged -> approve');
  });
});
