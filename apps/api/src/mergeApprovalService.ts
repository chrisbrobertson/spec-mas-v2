import type { MergeStatus, RunStatus } from './runQueryService.js';

export interface MergeApprovalRecord {
  runId: string;
  status: MergeStatus;
  updatedAt: string;
}

export interface MergeApprovalService {
  getStatus(runId: string, runStatus: RunStatus): MergeStatus;
  getRecord(runId: string, runStatus: RunStatus): MergeApprovalRecord;
  transition(runId: string, action: 'approve' | 'reject' | 'merge', runStatus: RunStatus): MergeApprovalRecord;
}

const TRANSITIONS: Record<MergeStatus, readonly ('approve' | 'reject' | 'merge')[]> = {
  awaiting_human_approval: ['approve', 'reject'],
  approved: ['reject', 'merge'],
  rejected: ['approve'],
  merged: []
};

function defaultMergeStatus(runStatus: RunStatus): MergeStatus {
  switch (runStatus) {
    case 'failed':
    case 'cancelled':
      return 'rejected';
    case 'queued':
    case 'running':
    case 'passed':
      return 'awaiting_human_approval';
  }
}

function actionToStatus(action: 'approve' | 'reject' | 'merge'): MergeStatus {
  switch (action) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'merge':
      return 'merged';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryMergeApprovalService implements MergeApprovalService {
  private readonly states = new Map<string, MergeApprovalRecord>();

  getStatus(runId: string, runStatus: RunStatus): MergeStatus {
    return this.getRecord(runId, runStatus).status;
  }

  getRecord(runId: string, runStatus: RunStatus): MergeApprovalRecord {
    const existing = this.states.get(runId);
    if (existing) {
      return existing;
    }

    const created: MergeApprovalRecord = {
      runId,
      status: defaultMergeStatus(runStatus),
      updatedAt: nowIso()
    };
    this.states.set(runId, created);
    return created;
  }

  transition(runId: string, action: 'approve' | 'reject' | 'merge', runStatus: RunStatus): MergeApprovalRecord {
    const current = this.getRecord(runId, runStatus);
    const allowedActions = TRANSITIONS[current.status];
    if (!allowedActions.includes(action)) {
      throw new Error(`invalid merge transition: ${current.status} -> ${action}`);
    }

    if (action === 'merge' && runStatus !== 'passed') {
      throw new Error(`cannot merge run with status ${runStatus}`);
    }

    const updated: MergeApprovalRecord = {
      runId,
      status: actionToStatus(action),
      updatedAt: nowIso()
    };
    this.states.set(runId, updated);
    return updated;
  }
}
