export interface SmokeProbe {
  name: string;
  run: () => Promise<{ ok: boolean; details: string }>;
}

export interface SmokeResult {
  ok: boolean;
  probeResults: Array<{ name: string; ok: boolean; details: string }>;
}

export async function runIntegrationSmoke(probes: readonly SmokeProbe[]): Promise<SmokeResult> {
  const probeResults: Array<{ name: string; ok: boolean; details: string }> = [];

  for (const probe of probes) {
    const result = await probe.run();
    probeResults.push({
      name: probe.name,
      ok: result.ok,
      details: result.details
    });
  }

  return {
    ok: probeResults.every((probe) => probe.ok),
    probeResults
  };
}
