export interface MatrixScenario {
  id: string;
  components: string[];
  run: () => Promise<boolean>;
}

export interface MatrixResult {
  pass: boolean;
  scenarios: Array<{ id: string; components: string[]; pass: boolean }>;
}

export async function runIntegrationMatrix(
  scenarios: readonly MatrixScenario[]
): Promise<MatrixResult> {
  const results: Array<{ id: string; components: string[]; pass: boolean }> = [];
  for (const scenario of scenarios) {
    const pass = await scenario.run();
    results.push({
      id: scenario.id,
      components: [...scenario.components].sort(),
      pass
    });
  }

  return {
    pass: results.every((scenario) => scenario.pass),
    scenarios: results.sort((left, right) => left.id.localeCompare(right.id))
  };
}
