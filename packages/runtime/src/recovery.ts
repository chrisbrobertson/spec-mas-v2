export type FailureKind =
  | 'timeout'
  | 'nonzero_exit'
  | 'invalid_output'
  | 'sandbox_error'
  | 'unknown';

export type RecoveryAction = 'retry' | 'restart' | 'fallback' | 'fail';

export interface RecoveryPolicy {
  maxRetries: number;
  maxRestarts: number;
  allowFallback: boolean;
}

export interface RecoveryContext {
  retriesUsed: number;
  restartsUsed: number;
}

export function classifyFailure(error: unknown): FailureKind {
  if (!(error instanceof Error)) {
    return 'unknown';
  }
  const message = error.message.toLowerCase();

  if (message.includes('timeout')) return 'timeout';
  if (message.includes('exit code')) return 'nonzero_exit';
  if (message.includes('sandbox')) return 'sandbox_error';
  if (message.includes('invalid')) return 'invalid_output';

  return 'unknown';
}

export function nextRecoveryAction(
  failure: FailureKind,
  context: RecoveryContext,
  policy: RecoveryPolicy
): RecoveryAction {
  if (policy.maxRetries < 0 || policy.maxRestarts < 0) {
    throw new Error('Recovery policy limits must be non-negative');
  }

  if (failure === 'sandbox_error' && context.restartsUsed < policy.maxRestarts) {
    return 'restart';
  }

  if (context.retriesUsed < policy.maxRetries) {
    return 'retry';
  }

  if (context.restartsUsed < policy.maxRestarts) {
    return 'restart';
  }

  if (policy.allowFallback) {
    return 'fallback';
  }

  return 'fail';
}
