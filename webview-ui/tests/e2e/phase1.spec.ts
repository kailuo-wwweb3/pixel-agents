/**
 * Phase 1 e2e tests — full-stack verification against the production build.
 *
 * Server is booted by playwright.phase1.config.ts via:
 *   node ../bin/pixel-agents.js start --mock 2
 *
 * Tests verify:
 *  1. The production build loads in the browser without errors
 *  2. REST API endpoints respond correctly
 *  3. WebSocket connection delivers agentCreated events for mock agents
 *  4. agentToolStart messages carry the toolName field (our Phase 1 signal fix)
 *  5. Both typing-class and reading-class tool names are sent by the server
 */
import { expect, test } from '@playwright/test';

// ── 1. Production app loads ───────────────────────────────────

test('production build loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`Uncaught: ${err.message}`));

  await page.goto('/');
  await page.waitForSelector('canvas', { timeout: 10000 });

  expect(errors, `Browser errors:\n${errors.join('\n')}`).toEqual([]);
  await expect(page.locator('canvas')).toBeVisible();
});

// ── 2. REST API ───────────────────────────────────────────────

test('GET /api/workspaces returns a workspace list', async ({ request }) => {
  const resp = await request.get('/api/workspaces');
  expect(resp.ok()).toBe(true);
  const data = (await resp.json()) as unknown[];
  expect(Array.isArray(data)).toBe(true);
  expect(data.length).toBeGreaterThan(0);
});

test('GET /api/layout returns a valid layout object', async ({ request }) => {
  const resp = await request.get('/api/layout');
  expect(resp.ok()).toBe(true);
  const layout = (await resp.json()) as Record<string, unknown>;
  expect(layout).toHaveProperty('version', 1);
  expect(layout).toHaveProperty('cols');
  expect(layout).toHaveProperty('rows');
  expect(layout).toHaveProperty('tiles');
  expect(layout).toHaveProperty('furniture');
});

// ── 3. WebSocket — agent lifecycle ────────────────────────────

test('WebSocket delivers agentCreated for mock agents', async ({ page }) => {
  const wsPromise = page.waitForEvent('websocket');
  await page.goto('/');
  const ws = await wsPromise;

  const agentIds: number[] = await new Promise((resolve, reject) => {
    const ids: number[] = [];
    const timeout = setTimeout(
      () =>
        ids.length > 0
          ? resolve(ids)
          : reject(new Error('Timed out waiting for agentCreated events')),
      12000,
    );

    ws.on('framereceived', ({ payload }) => {
      try {
        const msg = JSON.parse(payload as string) as Record<string, unknown>;
        if (msg.type === 'agentCreated' && typeof msg.id === 'number') {
          ids.push(msg.id);
        }
        // Also accept existingAgents (sent on reconnect)
        if (msg.type === 'existingAgents' && Array.isArray(msg.agents) && msg.agents.length > 0) {
          clearTimeout(timeout);
          resolve(msg.agents as number[]);
        }
        if (ids.length >= 2) {
          clearTimeout(timeout);
          resolve(ids);
        }
      } catch {
        // ignore non-JSON frames
      }
    });
  });

  expect(agentIds.length).toBeGreaterThanOrEqual(1);
});

// ── 4. agentToolStart carries toolName ───────────────────────

test('agentToolStart messages include a toolName field', async ({ page }) => {
  const wsPromise = page.waitForEvent('websocket');
  await page.goto('/');
  const ws = await wsPromise;

  const toolNames: string[] = await new Promise((resolve, reject) => {
    const names: string[] = [];
    const timeout = setTimeout(
      () =>
        names.length > 0
          ? resolve(names)
          : reject(
              new Error(
                'Timed out waiting for agentToolStart with toolName.\n' +
                  'Ensure mockSessions.ts includes toolName in agentToolStart broadcasts.',
              ),
            ),
      20000,
    );

    ws.on('framereceived', ({ payload }) => {
      try {
        const msg = JSON.parse(payload as string) as Record<string, unknown>;
        if (msg.type === 'agentToolStart' && typeof msg.toolName === 'string') {
          names.push(msg.toolName);
          if (names.length >= 3) {
            clearTimeout(timeout);
            resolve(names);
          }
        }
      } catch {
        // ignore
      }
    });
  });

  expect(toolNames.length).toBeGreaterThanOrEqual(1);
  // Every received toolName must be a non-empty string
  for (const name of toolNames) {
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  }
});

// ── 5. Action mapping — both typing and reading tools appear ──

test('mock agents emit both writing-class and reading-class tool names', async ({ page }) => {
  const WRITING_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit']);
  const READING_TOOLS = new Set(['Read', 'Glob', 'Grep']);

  const wsPromise = page.waitForEvent('websocket');
  await page.goto('/');
  const ws = await wsPromise;

  const seen = await new Promise<{ writing: string[]; reading: string[] }>((resolve, reject) => {
    const writing: string[] = [];
    const reading: string[] = [];

    // Allow up to 60s — mock sessions have random delays up to ~10s before first tool
    const timeout = setTimeout(() => {
      if (writing.length > 0 && reading.length > 0) {
        resolve({ writing, reading });
      } else {
        reject(
          new Error(
            `Timed out. writing tools seen: [${writing}], reading tools seen: [${reading}].\n` +
              'Check TOOL_SCENARIOS in mockSessions.ts includes both Edit/Write and Read/Glob/Grep entries.',
          ),
        );
      }
    }, 60000);

    ws.on('framereceived', ({ payload }) => {
      try {
        const msg = JSON.parse(payload as string) as Record<string, unknown>;
        if (msg.type === 'agentToolStart' && typeof msg.toolName === 'string') {
          const name = msg.toolName;
          if (WRITING_TOOLS.has(name) && !writing.includes(name)) writing.push(name);
          if (READING_TOOLS.has(name) && !reading.includes(name)) reading.push(name);
          if (writing.length > 0 && reading.length > 0) {
            clearTimeout(timeout);
            resolve({ writing, reading });
          }
        }
      } catch {
        // ignore
      }
    });
  });

  expect(seen.writing.length).toBeGreaterThan(0);
  expect(seen.reading.length).toBeGreaterThan(0);
});
