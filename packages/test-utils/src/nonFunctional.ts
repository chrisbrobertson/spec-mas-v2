export interface NonFunctionalMetrics {
  durationMs: number;
  errorRate: number;
  isolationBreaches: number;
}

export interface NonFunctionalBudget {
  maxDurationMs: number;
  maxErrorRate: number;
  maxIsolationBreaches: number;
}

export interface NonFunctionalEvaluation {
  pass: boolean;
  violations: string[];
}

export function evaluateNonFunctionalBudget(
  metrics: NonFunctionalMetrics,
  budget: NonFunctionalBudget
): NonFunctionalEvaluation {
  const violations: string[] = [];
  if (metrics.durationMs > budget.maxDurationMs) {
    violations.push(`duration exceeded budget (${metrics.durationMs}ms > ${budget.maxDurationMs}ms)`);
  }
  if (metrics.errorRate > budget.maxErrorRate) {
    violations.push(`error rate exceeded budget (${metrics.errorRate} > ${budget.maxErrorRate})`);
  }
  if (metrics.isolationBreaches > budget.maxIsolationBreaches) {
    violations.push(
      `isolation breaches exceeded budget (${metrics.isolationBreaches} > ${budget.maxIsolationBreaches})`
    );
  }

  return {
    pass: violations.length === 0,
    violations
  };
}
