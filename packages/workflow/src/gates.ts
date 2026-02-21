export type GateId = 'G1' | 'G2' | 'G3' | 'G4';

export interface GateContext {
  structurePass: boolean;
  semanticsPass: boolean;
  traceabilityPass: boolean;
  determinismPass: boolean;
}

export interface GateFinding {
  gateId: string;
  passed: boolean;
  message: string;
}

export interface GateRunResult {
  passed: boolean;
  findings: GateFinding[];
}

export type MergeApprovalStatus = 'awaiting_human_approval' | 'approved' | 'rejected' | 'merged';
export type MergeApprovalAction = 'approve' | 'reject' | 'merge';

export interface MergeApprovalState {
  runId: string;
  status: MergeApprovalStatus;
  updatedAt: string;
}

type GateEvaluator = (context: GateContext) => GateFinding;

const gateEvaluators: Record<GateId, GateEvaluator> = {
  G1(context) {
    return {
      gateId: 'G1',
      passed: context.structurePass,
      message: context.structurePass ? 'Structure validation passed' : 'Structure validation failed'
    };
  },
  G2(context) {
    return {
      gateId: 'G2',
      passed: context.semanticsPass,
      message: context.semanticsPass ? 'Semantic validation passed' : 'Semantic validation failed'
    };
  },
  G3(context) {
    return {
      gateId: 'G3',
      passed: context.traceabilityPass,
      message: context.traceabilityPass
        ? 'Traceability validation passed'
        : 'Traceability validation failed'
    };
  },
  G4(context) {
    return {
      gateId: 'G4',
      passed: context.determinismPass,
      message: context.determinismPass
        ? 'Determinism validation passed'
        : 'Determinism validation failed'
    };
  }
};

export function runGateSet(requiredGateIds: readonly string[], context: GateContext): GateRunResult {
  const seen = new Set<string>();
  const findings: GateFinding[] = [];

  for (const gateId of requiredGateIds) {
    if (seen.has(gateId)) {
      continue;
    }
    seen.add(gateId);

    const evaluator = gateEvaluators[gateId as GateId];
    if (!evaluator) {
      findings.push({
        gateId,
        passed: false,
        message: `Unknown gate "${gateId}"`
      });
      continue;
    }

    findings.push(evaluator(context));
  }

  return {
    passed: findings.every((finding) => finding.passed),
    findings
  };
}

export function applyMergeApprovalAction(
  state: MergeApprovalState,
  action: MergeApprovalAction
): MergeApprovalState {
  const allowedActions: Record<MergeApprovalStatus, readonly MergeApprovalAction[]> = {
    awaiting_human_approval: ['approve', 'reject'],
    approved: ['reject', 'merge'],
    rejected: ['approve'],
    merged: []
  };

  if (!allowedActions[state.status].includes(action)) {
    throw new Error(`invalid merge transition: ${state.status} -> ${action}`);
  }

  const nextStatus: Record<MergeApprovalAction, MergeApprovalStatus> = {
    approve: 'approved',
    reject: 'rejected',
    merge: 'merged'
  };

  return {
    ...state,
    status: nextStatus[action],
    updatedAt: new Date().toISOString()
  };
}
