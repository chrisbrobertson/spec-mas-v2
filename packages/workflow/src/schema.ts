import YAML from 'yaml';

export type WorkflowPhaseMode = 'sequential' | 'parallel';

export interface WorkflowPhase {
  id: string;
  mode: WorkflowPhaseMode;
  tasks: string[];
  gates: string[];
}

export interface WorkflowDefinition {
  version: 1;
  name: string;
  phases: WorkflowPhase[];
}

export interface WorkflowDiagnostic {
  path: string;
  message: string;
}

export interface WorkflowParseResult {
  workflow: WorkflowDefinition | null;
  diagnostics: WorkflowDiagnostic[];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function parseWorkflowYaml(input: string): WorkflowParseResult {
  let parsed: unknown;
  try {
    parsed = YAML.parse(input) as unknown;
  } catch (error) {
    return {
      workflow: null,
      diagnostics: [{ path: '$', message: `Invalid YAML: ${(error as Error).message}` }]
    };
  }

  const diagnostics: WorkflowDiagnostic[] = [];
  if (!parsed || typeof parsed !== 'object') {
    return {
      workflow: null,
      diagnostics: [{ path: '$', message: 'Workflow must be a YAML object' }]
    };
  }

  const source = parsed as Record<string, unknown>;
  const name = asString(source.name);
  if (!name) {
    diagnostics.push({ path: 'name', message: 'Workflow name is required' });
  }

  const phasesValue = source.phases;
  if (!Array.isArray(phasesValue) || phasesValue.length === 0) {
    diagnostics.push({ path: 'phases', message: 'Workflow must define at least one phase' });
  }

  const phaseIds = new Set<string>();
  const phases: WorkflowPhase[] = [];
  if (Array.isArray(phasesValue)) {
    phasesValue.forEach((phase, index) => {
      if (!phase || typeof phase !== 'object') {
        diagnostics.push({ path: `phases[${index}]`, message: 'Phase must be an object' });
        return;
      }
      const phaseObject = phase as Record<string, unknown>;
      const id = asString(phaseObject.id);
      if (!id) {
        diagnostics.push({ path: `phases[${index}].id`, message: 'Phase id is required' });
      } else if (phaseIds.has(id)) {
        diagnostics.push({ path: `phases[${index}].id`, message: `Duplicate phase id "${id}"` });
      } else {
        phaseIds.add(id);
      }

      const modeValue = phaseObject.mode ?? 'sequential';
      const mode =
        modeValue === 'sequential' || modeValue === 'parallel'
          ? (modeValue as WorkflowPhaseMode)
          : null;
      if (!mode) {
        diagnostics.push({
          path: `phases[${index}].mode`,
          message: 'Phase mode must be "sequential" or "parallel"'
        });
      }

      const taskValues = Array.isArray(phaseObject.tasks) ? phaseObject.tasks : null;
      if (!taskValues || taskValues.length === 0) {
        diagnostics.push({
          path: `phases[${index}].tasks`,
          message: 'Phase must include at least one task id'
        });
      }

      const tasks =
        taskValues?.map((task, taskIndex) => {
          const taskId = asString(task);
          if (!taskId) {
            diagnostics.push({
              path: `phases[${index}].tasks[${taskIndex}]`,
              message: 'Task id must be a non-empty string'
            });
            return null;
          }
          return taskId;
        }) ?? [];

      const gates = Array.isArray(phaseObject.gates)
        ? phaseObject.gates
            .map((gate, gateIndex) => {
              const gateId = asString(gate);
              if (!gateId) {
                diagnostics.push({
                  path: `phases[${index}].gates[${gateIndex}]`,
                  message: 'Gate id must be a non-empty string'
                });
                return null;
              }
              return gateId;
            })
            .filter((gate): gate is string => gate !== null)
        : [];

      if (id && mode && tasks.length > 0 && tasks.every((task) => task !== null)) {
        phases.push({
          id,
          mode,
          tasks: tasks.filter((task): task is string => task !== null),
          gates
        });
      }
    });
  }

  if (diagnostics.length > 0) {
    return {
      workflow: null,
      diagnostics
    };
  }

  return {
    workflow: {
      version: 1,
      name: name as string,
      phases
    },
    diagnostics: []
  };
}
