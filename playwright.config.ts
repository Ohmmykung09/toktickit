import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/lab-03/global-setup.ts',
  globalTeardown: './e2e/lab-03/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev',
      cwd: './server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'npm run dev',
      cwd: './client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
