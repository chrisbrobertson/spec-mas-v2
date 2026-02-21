import { describe, expect, it } from 'vitest';
import {
  accessibleSections,
  createAuthoringFlowState,
  editSection,
  submitGuidedAnswer,
  switchAuthoringMode
} from '../src/authoringFlow.js';

describe('authoring-flow', () => {
  it('advances guided sections deterministically and supports mode switching', () => {
    let state = createAuthoringFlowState('guided');

    expect(state.activeSectionId).toBe('overview');
    expect(accessibleSections(state)).toEqual(['overview']);

    state = submitGuidedAnswer(state, 'Payment service overview');
    expect(state.activeSectionId).toBe('functional-requirements');
    expect(accessibleSections(state)).toEqual(['overview', 'functional-requirements']);

    state = switchAuthoringMode(state, 'edit');
    expect(state.mode).toBe('edit');
    state = editSection(state, 'data-model', 'Entity: Payment');
    expect(state.activeSectionId).toBe('data-model');

    state = switchAuthoringMode(state, 'freeform');
    expect(state.mode).toBe('freeform');
    expect(state.activeSectionId).toBeNull();
  });

  it('rejects invalid guided operations', () => {
    const guidedState = createAuthoringFlowState('guided');

    expect(() => submitGuidedAnswer(guidedState, '   ')).toThrow('Guided answer cannot be blank');
    expect(() => editSection(guidedState, 'acceptance-criteria', 'criteria')).toThrow(
      'Section locked in guided mode: acceptance-criteria'
    );
  });

  it('handles edge case when switching back to guided after completion', () => {
    let state = createAuthoringFlowState('edit');
    state = editSection(state, 'overview', 'overview');
    state = editSection(state, 'functional-requirements', 'fr');
    state = editSection(state, 'data-model', 'dm');
    state = editSection(state, 'acceptance-criteria', 'ac');

    state = switchAuthoringMode(state, 'guided');
    expect(state.activeSectionId).toBe('acceptance-criteria');
    expect(accessibleSections(state)).toEqual([
      'overview',
      'functional-requirements',
      'data-model',
      'acceptance-criteria'
    ]);
  });
});
