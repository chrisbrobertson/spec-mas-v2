export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AdversarialFinding {
  id: string;
  severity: FindingSeverity;
  summary: string;
}

export interface AdversarialThreshold {
  maxLow: number;
  maxMedium: number;
  maxHigh: number;
  maxCritical: number;
}

export interface AdversarialEvaluation {
  pass: boolean;
  counts: Record<FindingSeverity, number>;
  violations: string[];
}

function emptyCounts(): Record<FindingSeverity, number> {
  return { low: 0, medium: 0, high: 0, critical: 0 };
}

export function evaluateAdversarialFindings(
  findings: readonly AdversarialFinding[],
  threshold: AdversarialThreshold
): AdversarialEvaluation {
  const counts = emptyCounts();
  findings.forEach((finding) => {
    counts[finding.severity] += 1;
  });

  const violations: string[] = [];
  if (counts.low > threshold.maxLow) {
    violations.push(`low findings exceed threshold (${counts.low} > ${threshold.maxLow})`);
  }
  if (counts.medium > threshold.maxMedium) {
    violations.push(`medium findings exceed threshold (${counts.medium} > ${threshold.maxMedium})`);
  }
  if (counts.high > threshold.maxHigh) {
    violations.push(`high findings exceed threshold (${counts.high} > ${threshold.maxHigh})`);
  }
  if (counts.critical > threshold.maxCritical) {
    violations.push(
      `critical findings exceed threshold (${counts.critical} > ${threshold.maxCritical})`
    );
  }

  return {
    pass: violations.length === 0,
    counts,
    violations
  };
}
