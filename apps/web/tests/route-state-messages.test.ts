import { describe, expect, it } from 'vitest';
import {
  artifactsEmptyStateMessage,
  logsEmptyStateMessage,
  runDetailEmptyStateMessage,
  runsEmptyStateMessage
} from '../src/runtime/routeStateMessages.js';

describe('route-state-messages', () => {
  it('returns empty-state prompts on happy empty routes', () => {
    expect(runsEmptyStateMessage(0)).toBe('No runs yet.');
    expect(runDetailEmptyStateMessage(0)).toBe('No phases reported yet.');
    expect(artifactsEmptyStateMessage(0)).toBe('No artifacts available for this run.');
    expect(logsEmptyStateMessage(0)).toBe('No log entries yet.');
  });

  it('returns undefined when route data is present', () => {
    expect(runsEmptyStateMessage(1)).toBeUndefined();
    expect(runDetailEmptyStateMessage(2)).toBeUndefined();
    expect(artifactsEmptyStateMessage(3)).toBeUndefined();
    expect(logsEmptyStateMessage(4)).toBeUndefined();
  });

  it('handles edge numeric inputs deterministically', () => {
    expect(runsEmptyStateMessage(-1)).toBeUndefined();
    expect(runDetailEmptyStateMessage(-1)).toBeUndefined();
    expect(artifactsEmptyStateMessage(-1)).toBeUndefined();
    expect(logsEmptyStateMessage(-1)).toBeUndefined();
  });
});
