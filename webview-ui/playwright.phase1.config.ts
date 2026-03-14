import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 1 e2e config — tests the full production stack via the CLI wrapper.
 *
 * Boots: node ../bin/pixel-agents.js start --mock 2
 * Serves: dist/webview/ on http://localhost:3000
 *
 * Run:  npm run test:e2e:phase1  (from webview-ui/)
 *   or: npm run test:phase1       (from repo root, includes build step)
 *
 * Prerequisites: npm run build must have been run first.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'phase1.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3099',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ../bin/pixel-agents.js start --mock 2',
    url: 'http://localhost:3099',
    env: { PORT: '3099' },
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 15000,
  },
});
