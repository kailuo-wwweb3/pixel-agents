/**
 * Mock Sessions — simulates Claude Code agent activity for visual testing.
 * Bypasses JSONL files and PTY entirely; broadcasts messages directly to
 * all connected WebSocket clients via the provided broadcast function.
 */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(): string {
  return `mock_${Math.random().toString(36).slice(2, 10)}`;
}

type Broadcast = (msg: unknown) => void;

// ── Tool scenarios ───────────────────────────────────────────

interface ToolScenario {
  name: string;
  status: string;
  durationMs: number;
}

const TOOL_SCENARIOS: ToolScenario[] = [
  { name: 'Read', status: 'Reading src/components/App.tsx', durationMs: 1800 },
  { name: 'Read', status: 'Reading server/src/wsManager.ts', durationMs: 1200 },
  { name: 'Grep', status: 'Searching code', durationMs: 900 },
  { name: 'Glob', status: 'Searching files', durationMs: 700 },
  { name: 'Edit', status: 'Editing src/App.tsx', durationMs: 2500 },
  { name: 'Write', status: 'Writing server/src/index.ts', durationMs: 2000 },
  { name: 'Bash', status: 'Running: npm run build', durationMs: 4000 },
  { name: 'Bash', status: 'Running: npx tsc --noEmit', durationMs: 2200 },
  { name: 'WebFetch', status: 'Fetching web content', durationMs: 1500 },
  { name: 'WebSearch', status: 'Searching the web', durationMs: 1300 },
  { name: 'Read', status: 'Reading webview-ui/src/vscodeApi.ts', durationMs: 800 },
  { name: 'Edit', status: 'Editing server/src/agentManager.ts', durationMs: 3000 },
  { name: 'Bash', status: 'Running: git status', durationMs: 600 },
  { name: 'Bash', status: 'Running: node scripts/generate-walls.js', durationMs: 1800 },
];

function pickScenarios(n: number): ToolScenario[] {
  const shuffled = [...TOOL_SCENARIOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ── Single-agent loop ────────────────────────────────────────

async function runAgentLoop(
  agentId: number,
  broadcast: Broadcast,
  signal: { stopped: boolean },
): Promise<void> {
  // Initial wander delay (stagger agents so they don't all start at once)
  await sleep(Math.random() * 3000);

  while (!signal.stopped) {
    // ── Turn: use 2–5 tools sequentially ──
    const tools = pickScenarios(2 + Math.floor(Math.random() * 4));

    for (const tool of tools) {
      if (signal.stopped) break;

      const toolId = uid();
      broadcast({
        type: 'agentToolStart',
        id: agentId,
        toolId,
        toolName: tool.name,
        status: tool.status,
      });

      await sleep(tool.durationMs);
      if (signal.stopped) break;

      broadcast({ type: 'agentToolDone', id: agentId, toolId });
      await sleep(300); // brief gap between tools
    }

    if (signal.stopped) break;

    // ── End of turn: agent is waiting for user ──
    broadcast({ type: 'agentStatus', id: agentId, status: 'waiting' });

    // Wait 4–10 seconds before next turn
    await sleep(4000 + Math.random() * 6000);
    if (signal.stopped) break;

    // ── New turn starts ──
    broadcast({ type: 'agentStatus', id: agentId, status: 'active' });
    await sleep(500 + Math.random() * 1000);
  }
}

// ── Sub-agent loop (spawned by parent during a Task tool) ────

async function runSubagentTurn(
  parentId: number,
  subId: number,
  parentToolId: string,
  broadcast: Broadcast,
): Promise<void> {
  const tools = pickScenarios(2 + Math.floor(Math.random() * 3));

  for (const tool of tools) {
    const subToolId = uid();
    broadcast({
      type: 'subagentToolStart',
      id: parentId,
      parentToolId,
      toolId: subToolId,
      toolName: tool.name,
      status: tool.status,
    });
    await sleep(tool.durationMs);
    broadcast({
      type: 'subagentToolDone',
      id: parentId,
      parentToolId,
      toolId: subToolId,
    });
    await sleep(200);
  }

  // Sub-agent done → clear it
  broadcast({ type: 'subagentClear', id: parentId, parentToolId });
  broadcast({ type: 'agentClosed', id: subId });
}

// ── Agent with sub-agents loop ───────────────────────────────

async function runAgentWithSubagentsLoop(
  agentId: number,
  nextSubIdRef: { current: number },
  broadcast: Broadcast,
  signal: { stopped: boolean },
): Promise<void> {
  await sleep(Math.random() * 4000);

  while (!signal.stopped) {
    // Do some regular tools first
    const regularTools = pickScenarios(1 + Math.floor(Math.random() * 2));
    for (const tool of regularTools) {
      if (signal.stopped) break;
      const toolId = uid();
      broadcast({
        type: 'agentToolStart',
        id: agentId,
        toolId,
        toolName: tool.name,
        status: tool.status,
      });
      await sleep(tool.durationMs);
      broadcast({ type: 'agentToolDone', id: agentId, toolId });
      await sleep(300);
    }

    if (signal.stopped) break;

    // Launch a Task sub-agent
    const taskToolId = uid();
    const subId = nextSubIdRef.current--;
    broadcast({
      type: 'agentToolStart',
      id: agentId,
      toolId: taskToolId,
      toolName: 'Task',
      status: `Subtask: Implement the authentication module`,
    });

    // Create sub-agent character
    broadcast({ type: 'agentCreated', id: subId });

    // Run sub-agent work
    await runSubagentTurn(agentId, subId, taskToolId, broadcast);

    await sleep(300);
    broadcast({ type: 'agentToolDone', id: agentId, toolId: taskToolId });

    if (signal.stopped) break;

    // Waiting
    broadcast({ type: 'agentStatus', id: agentId, status: 'waiting' });
    await sleep(5000 + Math.random() * 5000);
    if (signal.stopped) break;
    broadcast({ type: 'agentStatus', id: agentId, status: 'active' });
    await sleep(500);
  }
}

// ── Permission-wait scenario ─────────────────────────────────

async function runAgentWithPermissionLoop(
  agentId: number,
  broadcast: Broadcast,
  signal: { stopped: boolean },
): Promise<void> {
  await sleep(Math.random() * 5000);

  while (!signal.stopped) {
    // Some normal tools
    const tools = pickScenarios(2 + Math.floor(Math.random() * 2));
    for (const tool of tools) {
      if (signal.stopped) break;
      const toolId = uid();
      broadcast({
        type: 'agentToolStart',
        id: agentId,
        toolId,
        toolName: tool.name,
        status: tool.status,
      });
      await sleep(tool.durationMs);
      broadcast({ type: 'agentToolDone', id: agentId, toolId });
      await sleep(300);
    }

    if (signal.stopped) break;

    // Hang on a Bash tool (simulates permission wait)
    const bashToolId = uid();
    broadcast({
      type: 'agentToolStart',
      id: agentId,
      toolId: bashToolId,
      toolName: 'Bash',
      status: 'Running: rm -rf dist/',
    });

    // After 7s the permission bubble appears (server side uses PERMISSION_TIMER_DELAY_MS = 7000)
    // We simulate it directly at 8s
    await sleep(8000);
    if (signal.stopped) break;

    broadcast({ type: 'agentToolPermission', id: agentId });

    // User "approves" after 3–6 seconds
    await sleep(3000 + Math.random() * 3000);
    if (signal.stopped) break;

    broadcast({ type: 'agentToolPermissionClear', id: agentId });
    broadcast({ type: 'agentToolDone', id: agentId, toolId: bashToolId });

    // More work then waiting
    await sleep(500);
    broadcast({ type: 'agentStatus', id: agentId, status: 'waiting' });
    await sleep(6000 + Math.random() * 4000);
    if (signal.stopped) break;
    broadcast({ type: 'agentStatus', id: agentId, status: 'active' });
    await sleep(500);
  }
}

// ── Public API ───────────────────────────────────────────────

export interface MockSessionHandle {
  stop: () => void;
  agentIds: number[];
}

/**
 * Start N mock agents with varied behaviour patterns.
 * Returns a handle to stop all mock sessions.
 */
export function startMockSessions(broadcast: Broadcast, count: number = 3): MockSessionHandle {
  const signal = { stopped: false };
  const agentIds: number[] = [];
  // Sub-agent IDs count down from -1
  const nextSubIdRef = { current: -1 };

  // Assign behaviour patterns
  const patterns: Array<'normal' | 'subagent' | 'permission'> = [];
  for (let i = 0; i < count; i++) {
    if (i === 0 && count > 1) patterns.push('subagent');
    else if (i === 1 && count > 2) patterns.push('permission');
    else patterns.push('normal');
  }

  for (let i = 0; i < count; i++) {
    const agentId = i + 1;
    agentIds.push(agentId);

    // Stagger agent creation slightly
    setTimeout(() => {
      if (signal.stopped) return;
      broadcast({ type: 'agentCreated', id: agentId });

      const pattern = patterns[i];
      const loop =
        pattern === 'subagent'
          ? runAgentWithSubagentsLoop(agentId, nextSubIdRef, broadcast, signal)
          : pattern === 'permission'
            ? runAgentWithPermissionLoop(agentId, broadcast, signal)
            : runAgentLoop(agentId, broadcast, signal);

      loop.catch((err: unknown) => {
        console.error(`[Mock] Agent ${agentId} loop error:`, err);
      });
    }, i * 800);
  }

  return {
    agentIds,
    stop: () => {
      signal.stopped = true;
      for (const id of agentIds) {
        broadcast({ type: 'agentClosed', id });
      }
    },
  };
}
