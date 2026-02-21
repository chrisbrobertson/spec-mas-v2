export interface PipelineSummary {
  workflow: 'validate' | 'review' | 'plan' | 'run';
  status: 'success' | 'failure';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'skip';
    details?: string;
  }>;
}

export function renderPrSummary(summary: PipelineSummary): string {
  const icon = summary.status === 'success' ? '✅' : '❌';
  const lines = [`## ${icon} ${summary.workflow} pipeline`];

  for (const check of summary.checks) {
    const prefix = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚪';
    const detailSuffix = check.details ? ` — ${check.details}` : '';
    lines.push(`- ${prefix} ${check.name}${detailSuffix}`);
  }

  return lines.join('\n');
}
