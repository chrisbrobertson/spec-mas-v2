import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';
const API_BASE_URL = 'http://localhost:3100';

interface StartedRunResponse {
  run: {
    id: string;
    status: RunStatus;
    workingBranch: string;
  };
}

interface RunDetailResponse {
  run: {
    id: string;
    status: RunStatus;
  };
}

interface RunLogsResponse {
  runId: string;
  entries: Array<{
    sequence: number;
    message: string;
  }>;
}

interface RunArtifactsResponse {
  runId: string;
  paths: string[];
}

function runStatusLabel(status: RunStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'queued':
      return 'Queued';
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function parseJson<T>(request: Promise<import('@playwright/test').APIResponse>): Promise<{ status: number; body: T | undefined }> {
  const response = await request;
  const text = await response.text();
  let body: T | undefined;
  if (text) {
    try {
      body = JSON.parse(text) as T;
    } catch {
      body = undefined;
    }
  }

  return {
    status: response.status(),
    body
  };
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Spec-MAS Dashboard' })).toBeVisible();
  await expect(page.getByText('Sign in to access runs, artifacts, logs, and authoring workflows.')).toBeVisible();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Runs' })).toBeVisible();
}

async function startRealRun(request: APIRequestContext, projectId = 'alpha'): Promise<{ runId: string; status: RunStatus; workingBranch: string }> {
  const started = await parseJson<StartedRunResponse>(
    request.post(`${API_BASE_URL}/runs`, {
      headers: {
        'x-role': 'developer'
      },
      data: {
        projectId,
        initiatedBy: 'playwright-real-runtime'
      }
    })
  );

  expect(started.status, `expected run start to succeed, body=${JSON.stringify(started.body)}`).toBe(201);
  expect(started.body?.run?.id).toBeTruthy();

  const runId = started.body!.run.id;
  expect(runId).not.toMatch(/^run-\d+$/u);

  return {
    runId,
    status: started.body!.run.status,
    workingBranch: started.body!.run.workingBranch
  };
}

async function loadRun(request: APIRequestContext, runId: string): Promise<RunDetailResponse> {
  const runDetail = await parseJson<RunDetailResponse>(
    request.get(`${API_BASE_URL}/runs/${runId}`, {
      headers: {
        'x-role': 'developer'
      }
    })
  );

  expect(runDetail.status, `expected run detail to load for ${runId}`).toBe(200);
  return runDetail.body as RunDetailResponse;
}

async function waitForRunTerminal(
  request: APIRequestContext,
  runId: string,
  observedStatuses: Set<RunStatus>
): Promise<RunStatus> {
  let terminalStatus: RunStatus = 'queued';

  await expect
    .poll(
      async () => {
        const detail = await loadRun(request, runId);
        observedStatuses.add(detail.run.status);
        if (detail.run.status === 'passed' || detail.run.status === 'failed' || detail.run.status === 'cancelled') {
          terminalStatus = detail.run.status;
        }
        return detail.run.status;
      },
      {
        timeout: 120_000,
        intervals: [500, 1_000, 2_000, 3_000]
      }
    )
    .toMatch(/^(passed|failed|cancelled)$/u);

  return terminalStatus;
}

test('real-runtime run list shows dynamic run id and branch-scoped visibility', async ({ page, request }) => {
  test.setTimeout(180_000);

  const started = await startRealRun(request);
  expect(started.status).toBe('running');

  const observedStatuses = new Set<RunStatus>([started.status]);
  const finalStatus = await waitForRunTerminal(request, started.runId, observedStatuses);
  expect(observedStatuses.has('running')).toBeTruthy();

  await login(page, 'developer', 'developer');
  await page.goto('/projects/alpha/runs');

  await expect(page.getByText(/API: http:\/\/localhost:3100/)).toBeVisible();
  await expect(page.getByText('Health:')).toBeVisible();
  await expect(page.getByLabel('Project/Repo')).toBeVisible();
  await expect(page.getByLabel('Branch')).toBeVisible();

  const row = page.getByRole('listitem').filter({ hasText: started.runId });
  await expect(row).toBeVisible();
  await expect(row).toContainText(runStatusLabel(finalStatus));
  await expect(row).toContainText(started.workingBranch);

  await page.getByLabel('Branch').selectOption(started.workingBranch);
  await expect(row).toBeVisible();
});

test('real-runtime run detail surfaces persisted artifacts and log stream', async ({ page, request }) => {
  test.setTimeout(180_000);

  const started = await startRealRun(request);
  const observedStatuses = new Set<RunStatus>([started.status]);
  await waitForRunTerminal(request, started.runId, observedStatuses);

  const logs = await parseJson<RunLogsResponse>(
    request.get(`${API_BASE_URL}/runs/${started.runId}/logs`, {
      headers: {
        'x-role': 'developer'
      }
    })
  );
  expect(logs.status).toBe(200);
  expect(logs.body?.entries.length ?? 0).toBeGreaterThan(0);
  expect(logs.body?.entries.some((entry) => entry.message.includes('run started'))).toBeTruthy();

  let artifacts: { status: number; body: RunArtifactsResponse | undefined } = { status: 0, body: undefined };
  await expect
    .poll(
      async () => {
        artifacts = await parseJson<RunArtifactsResponse>(
          request.get(`${API_BASE_URL}/runs/${started.runId}/artifacts`, {
            headers: {
              'x-role': 'developer'
            }
          })
        );
        return artifacts.status === 200 ? (artifacts.body?.paths.length ?? 0) : 0;
      },
      {
        timeout: 30_000,
        intervals: [500, 1_000, 2_000]
      }
    )
    .toBeGreaterThan(0);
  expect(artifacts.body?.paths.some((path) => path.endsWith('run-summary.md'))).toBeTruthy();
  expect(artifacts.body?.paths.some((path) => path.endsWith('validation/gate-results.json'))).toBeTruthy();

  await login(page, 'developer', 'developer');
  await page.goto(`/projects/alpha/runs/${started.runId}`);
  await expect(page.getByRole('heading', { name: 'Run Detail' })).toBeVisible();
  await expect(page.getByText(new RegExp(`^${escapeRegex(started.runId)}$`, 'u'))).toBeVisible();
  await expect(page.getByText(/Merge status:/)).toContainText('awaiting_human_approval');

  await page.getByRole('link', { name: 'Artifacts' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/alpha/runs/${started.runId}/artifacts$`));
  await expect(page.getByRole('heading', { name: 'Artifacts' })).toBeVisible();
  await expect(page.getByText(/Root nodes:/u)).toBeVisible();
  await expect(page.getByRole('button', { name: /run-summary\.md/u })).toBeVisible();
  await page.getByRole('button', { name: /validation\/gate-results\.json/u }).click();
  await expect(page.getByText('Renderer:')).toBeVisible();

  await page.goto(`/projects/alpha/runs/${started.runId}/logs`);
  await expect(page.getByRole('heading', { name: 'Live Log Stream' })).toBeVisible();
  await expect(page.getByText(/connected=true/)).toBeVisible();
  await expect(page.getByText(/seq=\[[0-9,]+\]/u)).toBeVisible();
});
