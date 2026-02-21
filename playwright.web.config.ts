import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests-e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4173'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ],
  webServer: {
    command: 'corepack pnpm --filter @specmas/web build && python3 -m http.server 4173',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
