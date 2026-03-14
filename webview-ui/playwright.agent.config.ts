import { defineConfig, devices } from '@playwright/test';

/**
 * Agent-creation e2e config — boots the production server WITHOUT mock agents
 * so that clicking "+ Agent" attempts a real agent spawn via node-pty.
 *
 * Server stderr is piped so posix_spawnp / spawn errors appear in test output.
 *
 * Run: npm run test:e2e:agent  (from webview-ui/)
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'agent-creation.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3098',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ../bin/pixel-agents.js start',
    url: 'http://localhost:3098',
    env: { PORT: '3098' },
    reuseExistingServer: false,
    // Pipe both so server-side errors (posix_spawnp, etc.) appear in test output
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 15000,
  },
});
