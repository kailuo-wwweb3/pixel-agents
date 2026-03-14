/**
 * Agent creation e2e test — automates clicking "+ Agent" and reports
 * everything the frontend receives (WebSocket messages + browser console).
 *
 * Server stderr is piped by playwright.agent.config.ts, so any backend
 * errors (posix_spawnp, spawn failures, etc.) appear directly in the
 * Playwright test runner output alongside these results.
 */
import { expect, test } from '@playwright/test';

test('clicking + Agent: captures browser output and WebSocket response', async ({ page }) => {
  const browserErrors: string[] = [];
  const browserLogs: string[] = [];
  const wsMessages: string[] = [];

  // Capture all browser console output
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error') {
      browserErrors.push(text);
    } else {
      browserLogs.push(text);
    }
  });

  page.on('pageerror', (err) => {
    browserErrors.push(`[pageerror] ${err.message}`);
  });

  // Intercept WebSocket and record all inbound frames
  const wsPromise = page.waitForEvent('websocket');
  await page.goto('/');
  const ws = await wsPromise;

  ws.on('framereceived', ({ payload }) => {
    try {
      const msg = JSON.parse(payload as string) as Record<string, unknown>;
      // Filter out high-frequency rendering noise — keep agent lifecycle messages
      const type = msg.type as string;
      if (
        type === 'agentCreated' ||
        type === 'agentClosed' ||
        type === 'agentStatus' ||
        type === 'agentToolStart' ||
        type === 'agentToolDone' ||
        type === 'existingAgents' ||
        type === 'error'
      ) {
        wsMessages.push(JSON.stringify(msg));
      }
    } catch {
      wsMessages.push(`[non-JSON frame] ${String(payload).slice(0, 120)}`);
    }
  });

  // Wait for canvas to confirm the app is fully loaded
  await page.waitForSelector('canvas', { timeout: 10000 });

  // Drain any startup WS messages (existingAgents, etc.) before clicking
  await page.waitForTimeout(1000);
  wsMessages.length = 0; // reset — only interested in post-click messages

  // Click the "+ Agent" button
  const agentBtn = page.getByRole('button', { name: '+ Agent' });
  await expect(agentBtn).toBeVisible();
  console.log('\n[Test] Clicking "+ Agent"...');
  await agentBtn.click();

  // Wait up to 5s for any server response to arrive
  await page.waitForTimeout(5000);

  // ── Report ────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  WebSocket messages received after click:');
  console.log('══════════════════════════════════════════');
  if (wsMessages.length === 0) {
    console.log('  (none — server likely threw before responding)');
  } else {
    for (const m of wsMessages) console.log(' ', m);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Browser console errors:');
  console.log('══════════════════════════════════════════');
  if (browserErrors.length === 0) {
    console.log('  (none)');
  } else {
    for (const e of browserErrors) console.log(' ', e);
  }

  console.log('\n══════════════════════════════════════════');
  console.log('  Browser console logs (filtered):');
  console.log('══════════════════════════════════════════');
  const interestingLogs = browserLogs.filter(
    (l) => l.includes('Agent') || l.includes('error') || l.includes('warn') || l.includes('WS'),
  );
  if (interestingLogs.length === 0) {
    console.log('  (nothing relevant)');
  } else {
    for (const l of interestingLogs) console.log(' ', l);
  }
  console.log('');

  // Canvas must still be visible — page must not have crashed
  await expect(page.locator('canvas')).toBeVisible();

  // If the launch failed, the error banner should be visible with a message
  const banner = page.locator('[data-testid="launch-error-banner"]');
  const bannerVisible = await banner.isVisible();
  if (bannerVisible) {
    const bannerText = await banner.innerText();
    console.log('\n[Test] Error banner shown to user:', bannerText);
  } else {
    console.log('\n[Test] No error banner — agent may have launched successfully');
  }
});
