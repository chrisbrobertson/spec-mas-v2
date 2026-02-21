export type IssueState = 'todo' | 'started' | 'passed' | 'failed' | 'handoff';

export interface IssueTransitionRequest {
  from: IssueState;
  to: IssueState;
  actor: string;
  summary: string;
}

export interface IssueTransitionResult {
  ok: boolean;
  comment: string;
}

const legalTransitions: Record<IssueState, IssueState[]> = {
  todo: ['started'],
  started: ['passed', 'failed', 'handoff'],
  passed: [],
  failed: ['started', 'handoff'],
  handoff: ['started']
};

function transitionTag(state: IssueState): string {
  switch (state) {
    case 'started':
      return 'STARTED';
    case 'passed':
      return 'PASS';
    case 'failed':
      return 'FAIL';
    case 'handoff':
      return 'HANDOFF';
    case 'todo':
    default:
      return 'TODO';
  }
}

export function canTransition(from: IssueState, to: IssueState): boolean {
  return legalTransitions[from].includes(to);
}

export function transitionIssueState(request: IssueTransitionRequest): IssueTransitionResult {
  if (!canTransition(request.from, request.to)) {
    throw new Error(`Illegal issue transition: ${request.from} -> ${request.to}`);
  }

  return {
    ok: true,
    comment: [
      `### ${transitionTag(request.to)}`,
      `from: ${request.from}`,
      `to: ${request.to}`,
      `actor: ${request.actor}`,
      `summary: ${request.summary}`
    ].join('\n')
  };
}
