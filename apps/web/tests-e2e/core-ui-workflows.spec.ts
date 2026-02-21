import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/apps/web/tests-e2e/harness.html');
});

test('validates dashboard shell health workflow', async ({ page }) => {
  await expect(page.getByTestId('dashboard-status')).toHaveText('unhealthy');
  await expect(page.getByTestId('dashboard-route-count')).toHaveText('5');

  await page.getByTestId('dashboard-load-healthy').click();
  await expect(page.getByTestId('dashboard-status')).toHaveText('healthy');
  await expect(page.getByTestId('dashboard-timestamp')).toHaveText('2026-02-19T00:00:00.000Z');

  await page.getByTestId('dashboard-load-degraded').click();
  await expect(page.getByTestId('dashboard-status')).toHaveText('unhealthy');
  await expect(page.getByTestId('dashboard-timestamp')).toHaveText('2026-02-19T00:00:01.000Z');

  await page.getByTestId('dashboard-load-error').click();
  await expect(page.getByTestId('dashboard-status')).toHaveText('unhealthy');
  await expect(page.getByTestId('dashboard-timestamp')).toHaveText('2026-02-19T00:00:02.000Z');
});

test('validates run list/detail workflow and duplicate sequence failure', async ({ page }) => {
  await page.getByTestId('runs-render-core').click();
  await expect(page.locator('[data-testid="run-item"]').nth(0)).toHaveText('run-2:Running');
  await expect(page.locator('[data-testid="run-item"]').nth(1)).toHaveText('run-1:Passed');
  await expect(page.locator('[data-testid="phase-item"]').nth(0)).toHaveText('1:ph-1:Running');
  await expect(page.locator('[data-testid="phase-item"]').nth(1)).toHaveText('2:ph-2:Pending');
  await expect(page.getByTestId('run-phase-counts')).toContainText('"pending":1');

  await page.getByTestId('runs-render-duplicate').click();
  await expect(page.getByTestId('runs-error')).toHaveText('Duplicate phase sequence: 1');
});

test('validates artifact explorer rendering with valid, invalid, and empty inputs', async ({ page }) => {
  await page.getByTestId('artifacts-valid').click();
  await expect(page.getByTestId('artifacts-root-children')).toHaveText('phases,validation,run-summary.md');
  await expect(page.getByTestId('artifacts-renderer')).toHaveText('json');
  await expect(page.getByTestId('artifacts-summary')).toHaveText('JSON object with 2 keys');

  await page.getByTestId('artifacts-invalid').click();
  await expect(page.getByTestId('artifacts-renderer')).toHaveText('text');
  await expect(page.getByTestId('artifacts-summary')).toHaveText('Unparseable structured content');

  await page.getByTestId('artifacts-empty').click();
  await expect(page.getByTestId('artifacts-root-children')).toHaveText('');
  await expect(page.getByTestId('artifacts-renderer')).toHaveText('markdown');
  await expect(page.getByTestId('artifacts-summary')).toHaveText('# Summary');
});

test('validates live log stream lifecycle and invalid-sequence failure', async ({ page }) => {
  await page.getByTestId('logs-connect').click();
  await page.getByTestId('logs-seed').click();

  await expect(page.getByTestId('logs-connected')).toHaveText('true');
  await expect(page.getByTestId('logs-sequences')).toHaveText('1,2,3');
  await expect(page.getByTestId('logs-last-sequence')).toHaveText('3');

  await page.getByTestId('logs-disconnect').click();
  await expect(page.getByTestId('logs-connected')).toHaveText('false');

  await page.getByTestId('logs-reconnect').click();
  await expect(page.getByTestId('logs-connected')).toHaveText('true');
  await expect(page.getByTestId('logs-reconnect-count')).toHaveText('1');
  await expect(page.getByTestId('logs-timeline')).toContainText('disconnect,reconnect');

  await page.getByTestId('logs-invalid').click();
  await expect(page.getByTestId('logs-error')).toHaveText('Invalid log sequence: 0');
});

test('validates authoring guided/edit/freeform workflow plus validation errors', async ({ page }) => {
  await expect(page.getByTestId('authoring-mode')).toHaveText('guided');
  await expect(page.getByTestId('authoring-active')).toHaveText('overview');
  await expect(page.getByTestId('authoring-accessible')).toHaveText('overview');

  await page.getByTestId('authoring-submit-overview').click();
  await expect(page.getByTestId('authoring-active')).toHaveText('functional-requirements');
  await expect(page.getByTestId('authoring-accessible')).toHaveText('overview,functional-requirements');
  await expect(page.getByTestId('authoring-completed')).toHaveText('overview');

  await page.getByTestId('authoring-submit-blank').click();
  await expect(page.getByTestId('authoring-error')).toHaveText('Guided answer cannot be blank');

  await page.getByTestId('authoring-switch-edit').click();
  await expect(page.getByTestId('authoring-mode')).toHaveText('edit');

  await page.getByTestId('authoring-edit-data-model').click();
  await expect(page.getByTestId('authoring-active')).toHaveText('data-model');
  await expect(page.getByTestId('authoring-completed')).toContainText('data-model');

  await page.getByTestId('authoring-switch-freeform').click();
  await expect(page.getByTestId('authoring-mode')).toHaveText('freeform');
  await expect(page.getByTestId('authoring-active')).toHaveText('');

  await page.getByTestId('authoring-reset-guided').click();
  await page.getByTestId('authoring-edit-locked').click();
  await expect(page.getByTestId('authoring-error')).toHaveText('Section locked in guided mode: acceptance-criteria');
});
