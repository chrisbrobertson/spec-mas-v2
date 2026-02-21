import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/web/tests-e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://localhost:3000'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ],
  webServer: {
    command:
      'DATABASE_URL=${DATABASE_URL:-file:./specmas.db} corepack pnpm db:bootstrap && DATABASE_URL=${DATABASE_URL:-file:./specmas.db} corepack pnpm dev:full',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000
  }
});
