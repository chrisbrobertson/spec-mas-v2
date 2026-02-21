export type RoutingRole = 'implement' | 'test' | 'review';

export interface RoutingCandidate {
  adapterId: string;
  supportsRoles: readonly RoutingRole[];
  healthy: boolean;
  priority: number;
}

export interface RoutingRequest {
  role: RoutingRole;
  preferredOrder?: readonly string[];
}

export interface RoutingDecision {
  selectedAdapterId: string | null;
  fallbackChain: string[];
  explanation: string;
}

function preferenceRank(adapterId: string, preferredOrder: readonly string[] | undefined): number {
  if (!preferredOrder) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = preferredOrder.indexOf(adapterId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function selectAdapter(
  request: RoutingRequest,
  candidates: readonly RoutingCandidate[]
): RoutingDecision {
  const eligible = candidates.filter((candidate) => candidate.supportsRoles.includes(request.role));
  if (eligible.length === 0) {
    return {
      selectedAdapterId: null,
      fallbackChain: [],
      explanation: `No adapters support role "${request.role}".`
    };
  }

  const ordered = [...eligible].sort((left, right) => {
    const leftPref = preferenceRank(left.adapterId, request.preferredOrder);
    const rightPref = preferenceRank(right.adapterId, request.preferredOrder);
    if (leftPref !== rightPref) {
      return leftPref - rightPref;
    }
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.adapterId.localeCompare(right.adapterId);
  });

  const selected = ordered.find((candidate) => candidate.healthy) ?? null;
  const fallbackChain = ordered
    .filter((candidate) => candidate.healthy && candidate.adapterId !== selected?.adapterId)
    .map((candidate) => candidate.adapterId);
  const skipped = ordered.filter((candidate) => !candidate.healthy).map((candidate) => candidate.adapterId);

  if (!selected) {
    return {
      selectedAdapterId: null,
      fallbackChain: [],
      explanation: `Eligible adapters are unhealthy: ${skipped.join(', ')}.`
    };
  }

  const explanation = [
    `Selected ${selected.adapterId} for role "${request.role}".`,
    fallbackChain.length > 0 ? `Fallback chain: ${fallbackChain.join(' -> ')}.` : 'No fallback required.',
    skipped.length > 0 ? `Skipped unhealthy adapters: ${skipped.join(', ')}.` : 'All evaluated adapters healthy.'
  ].join(' ');

  return {
    selectedAdapterId: selected.adapterId,
    fallbackChain,
    explanation
  };
}
