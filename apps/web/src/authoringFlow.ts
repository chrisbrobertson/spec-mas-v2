export type AuthoringMode = 'guided' | 'edit' | 'freeform';
export type AuthoringSectionId = 'overview' | 'functional-requirements' | 'data-model' | 'acceptance-criteria';

export interface AuthoringSection {
  id: AuthoringSectionId;
  title: string;
  content: string;
  completed: boolean;
}

export interface AuthoringFlowState {
  mode: AuthoringMode;
  activeSectionId: AuthoringSectionId | null;
  sections: AuthoringSection[];
}

const SECTION_ORDER: Array<Pick<AuthoringSection, 'id' | 'title'>> = [
  { id: 'overview', title: 'Overview' },
  { id: 'functional-requirements', title: 'Functional Requirements' },
  { id: 'data-model', title: 'Data Model' },
  { id: 'acceptance-criteria', title: 'Acceptance Criteria' }
];

function buildSections(): AuthoringSection[] {
  return SECTION_ORDER.map((section) => ({
    ...section,
    content: '',
    completed: false
  }));
}

function findSectionIndex(
  sections: AuthoringSection[],
  sectionId: AuthoringSectionId
): number {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) {
    throw new Error(`Unknown section: ${sectionId}`);
  }
  return index;
}

function firstIncompleteSectionId(
  sections: AuthoringSection[]
): AuthoringSectionId | null {
  const firstIncomplete = sections.find((section) => !section.completed);
  return firstIncomplete ? firstIncomplete.id : null;
}

function copyState(state: AuthoringFlowState): AuthoringFlowState {
  return {
    ...state,
    sections: state.sections.map((section) => ({ ...section }))
  };
}

export function createAuthoringFlowState(mode: AuthoringMode = 'guided'): AuthoringFlowState {
  const sections = buildSections();

  if (mode === 'freeform') {
    return {
      mode,
      activeSectionId: null,
      sections
    };
  }

  return {
    mode,
    activeSectionId: sections[0].id,
    sections
  };
}

export function switchAuthoringMode(
  state: AuthoringFlowState,
  mode: AuthoringMode
): AuthoringFlowState {
  const nextState = copyState(state);
  nextState.mode = mode;

  if (mode === 'freeform') {
    nextState.activeSectionId = null;
    return nextState;
  }

  if (mode === 'guided') {
    nextState.activeSectionId = firstIncompleteSectionId(nextState.sections) ?? SECTION_ORDER[SECTION_ORDER.length - 1].id;
    return nextState;
  }

  nextState.activeSectionId = nextState.activeSectionId ?? SECTION_ORDER[0].id;
  return nextState;
}

export function accessibleSections(state: AuthoringFlowState): AuthoringSectionId[] {
  if (state.mode !== 'guided') {
    return state.sections.map((section) => section.id);
  }

  const firstIncomplete = firstIncompleteSectionId(state.sections);
  if (!firstIncomplete) {
    return state.sections.map((section) => section.id);
  }

  const maxIndex = findSectionIndex(state.sections, firstIncomplete);
  return state.sections.slice(0, maxIndex + 1).map((section) => section.id);
}

export function submitGuidedAnswer(
  state: AuthoringFlowState,
  answer: string
): AuthoringFlowState {
  if (state.mode !== 'guided') {
    throw new Error('Guided answers require guided mode');
  }

  if (!state.activeSectionId) {
    throw new Error('No active guided section');
  }

  const trimmed = answer.trim();
  if (!trimmed) {
    throw new Error('Guided answer cannot be blank');
  }

  const nextState = copyState(state);
  const currentIndex = findSectionIndex(nextState.sections, state.activeSectionId);
  nextState.sections[currentIndex].content = trimmed;
  nextState.sections[currentIndex].completed = true;

  const nextIncomplete = nextState.sections.find((section, index) => index > currentIndex && !section.completed);
  nextState.activeSectionId = nextIncomplete ? nextIncomplete.id : nextState.sections[currentIndex].id;

  return nextState;
}

export function editSection(
  state: AuthoringFlowState,
  sectionId: AuthoringSectionId,
  content: string
): AuthoringFlowState {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Section content cannot be blank');
  }

  const nextState = copyState(state);
  const targetIndex = findSectionIndex(nextState.sections, sectionId);

  if (state.mode === 'guided') {
    const allowed = accessibleSections(state);
    if (!allowed.includes(sectionId)) {
      throw new Error(`Section locked in guided mode: ${sectionId}`);
    }
  }

  nextState.sections[targetIndex].content = trimmed;
  nextState.sections[targetIndex].completed = true;

  if (nextState.mode === 'guided') {
    nextState.activeSectionId = firstIncompleteSectionId(nextState.sections) ?? sectionId;
  } else if (nextState.mode === 'edit') {
    nextState.activeSectionId = sectionId;
  } else {
    nextState.activeSectionId = null;
  }

  return nextState;
}
