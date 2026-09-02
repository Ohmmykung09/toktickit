import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
