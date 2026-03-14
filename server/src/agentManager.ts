import * as fs from 'fs';
import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';

import { JSONL_POLL_INTERVAL_MS } from './constants.js';
import { ensureProjectScan, readNewLines, startFileWatching } from './fileWatcher.js';
import { cancelPermissionTimer, cancelWaitingTimer } from './timerManager.js';
import type { AgentState, PersistedAgent } from './types.js';

const AGENTS_FILE = path.join(os.homedir(), '.pixel-agents', 'agents.json');

export function getProjectDirPath(cwd?: string): string | null {
  const workspacePath = cwd || process.cwd();
  if (!workspacePath) return null;
  const dirName = workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
  const projectDir = path.join(os.homedir(), '.claude', 'projects', dirName);
  console.log(`[Pixel Agents] Project dir: ${workspacePath} → ${dirName}`);
  return projectDir;
}

export async function launchNewAgent(
  nextAgentIdRef: { current: number },
  agents: Map<number, AgentState>,
  activeAgentIdRef: { current: number | null },
  knownJsonlFiles: Set<string>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
  projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
  send: (msg: unknown) => void,
  persistAgentsFn: () => void,
  folderPath?: string,
  workspaceFolders?: string[],
): Promise<void> {
  const cwd = folderPath || workspaceFolders?.[0] || process.cwd();
  const isMultiRoot = !!(workspaceFolders && workspaceFolders.length > 1);

  const sessionId = crypto.randomUUID();

  const ptyInstance = pty.spawn('claude', ['--session-id', sessionId], {
    name: 'xterm-color',
    cols: 220,
    rows: 50,
    cwd,
    env: process.env as Record<string, string>,
  });

  const projectDir = getProjectDirPath(cwd);
  if (!projectDir) {
    console.log(`[Pixel Agents] No project dir, cannot track agent`);
    ptyInstance.kill();
    return;
  }

  const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
  knownJsonlFiles.add(expectedFile);

  const id = nextAgentIdRef.current++;
  const folderName = isMultiRoot && cwd ? path.basename(cwd) : undefined;
  const agent: AgentState = {
    id,
    ptyInstance,
    projectDir,
    jsonlFile: expectedFile,
    fileOffset: 0,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
    folderName,
  };

  agents.set(id, agent);
  activeAgentIdRef.current = id;
  persistAgentsFn();

  console.log(`[Pixel Agents] Agent ${id}: spawned PTY for session ${sessionId}`);
  send({ type: 'agentCreated', id, folderName });

  // Forward PTY output to client
  ptyInstance.onData((data: string) => {
    send({ type: 'ptyData', id, data });
  });

  ptyInstance.onExit(() => {
    console.log(`[Pixel Agents] Agent ${id}: PTY exited`);
    if (agents.has(id)) {
      removeAgent(
        id,
        agents,
        fileWatchers,
        pollingTimers,
        waitingTimers,
        permissionTimers,
        jsonlPollTimers,
        persistAgentsFn,
      );
      send({ type: 'agentClosed', id });
    }
  });

  ensureProjectScan(
    projectDir,
    knownJsonlFiles,
    projectScanTimerRef,
    activeAgentIdRef,
    nextAgentIdRef,
    agents,
    fileWatchers,
    pollingTimers,
    waitingTimers,
    permissionTimers,
    send,
    persistAgentsFn,
  );

  const pollTimer = setInterval(() => {
    try {
      if (fs.existsSync(agent.jsonlFile)) {
        console.log(
          `[Pixel Agents] Agent ${id}: found JSONL file ${path.basename(agent.jsonlFile)}`,
        );
        clearInterval(pollTimer);
        jsonlPollTimers.delete(id);
        startFileWatching(
          id,
          agent.jsonlFile,
          agents,
          fileWatchers,
          pollingTimers,
          waitingTimers,
          permissionTimers,
          send,
        );
        readNewLines(id, agents, waitingTimers, permissionTimers, send);
      }
    } catch {
      /* file may not exist yet */
    }
  }, JSONL_POLL_INTERVAL_MS);
  jsonlPollTimers.set(id, pollTimer);
}

export function removeAgent(
  agentId: number,
  agents: Map<number, AgentState>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
  persistAgentsFn: () => void,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  const jpTimer = jsonlPollTimers.get(agentId);
  if (jpTimer) clearInterval(jpTimer);
  jsonlPollTimers.delete(agentId);

  fileWatchers.get(agentId)?.close();
  fileWatchers.delete(agentId);
  const pt = pollingTimers.get(agentId);
  if (pt) clearInterval(pt);
  pollingTimers.delete(agentId);
  try {
    fs.unwatchFile(agent.jsonlFile);
  } catch {
    /* ignore */
  }

  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);

  try {
    agent.ptyInstance.kill();
  } catch {
    /* ignore */
  }

  agents.delete(agentId);
  persistAgentsFn();
}

export function persistAgents(agents: Map<number, AgentState>): void {
  const persisted: PersistedAgent[] = [];
  for (const agent of agents.values()) {
    persisted.push({
      id: agent.id,
      jsonlFile: agent.jsonlFile,
      projectDir: agent.projectDir,
      folderName: agent.folderName,
    });
  }
  try {
    const dir = path.dirname(AGENTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(persisted, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Pixel Agents] Failed to persist agents:', err);
  }
}

export function loadPersistedAgents(): PersistedAgent[] {
  try {
    if (!fs.existsSync(AGENTS_FILE)) return [];
    const raw = fs.readFileSync(AGENTS_FILE, 'utf-8');
    return JSON.parse(raw) as PersistedAgent[];
  } catch {
    return [];
  }
}

export function restoreAgents(
  nextAgentIdRef: { current: number },
  agents: Map<number, AgentState>,
  knownJsonlFiles: Set<string>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  jsonlPollTimers: Map<number, ReturnType<typeof setInterval>>,
  projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
  activeAgentIdRef: { current: number | null },
  send: (msg: unknown) => void,
  persistAgentsFn: () => void,
  _workspaceFolders: string[],
): void {
  const persisted = loadPersistedAgents();
  if (persisted.length === 0) return;

  let maxId = 0;
  let restoredProjectDir: string | null = null;

  for (const p of persisted) {
    // Create a dummy PTY placeholder (won't be used; old sessions are dead)
    // We still restore JSONL watching so status updates work if agent is running
    const dummyPty = pty.spawn('cat', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });
    dummyPty.kill();

    const agent: AgentState = {
      id: p.id,
      ptyInstance: dummyPty,
      projectDir: p.projectDir,
      jsonlFile: p.jsonlFile,
      fileOffset: 0,
      lineBuffer: '',
      activeToolIds: new Set(),
      activeToolStatuses: new Map(),
      activeToolNames: new Map(),
      activeSubagentToolIds: new Map(),
      activeSubagentToolNames: new Map(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
      folderName: p.folderName,
    };

    agents.set(p.id, agent);
    knownJsonlFiles.add(p.jsonlFile);
    console.log(`[Pixel Agents] Restored agent ${p.id}`);

    if (p.id > maxId) maxId = p.id;
    restoredProjectDir = p.projectDir;

    try {
      if (fs.existsSync(p.jsonlFile)) {
        const stat = fs.statSync(p.jsonlFile);
        agent.fileOffset = stat.size;
        startFileWatching(
          p.id,
          p.jsonlFile,
          agents,
          fileWatchers,
          pollingTimers,
          waitingTimers,
          permissionTimers,
          send,
        );
      } else {
        const pollTimer = setInterval(() => {
          try {
            if (fs.existsSync(agent.jsonlFile)) {
              console.log(`[Pixel Agents] Restored agent ${p.id}: found JSONL file`);
              clearInterval(pollTimer);
              jsonlPollTimers.delete(p.id);
              const stat = fs.statSync(agent.jsonlFile);
              agent.fileOffset = stat.size;
              startFileWatching(
                p.id,
                agent.jsonlFile,
                agents,
                fileWatchers,
                pollingTimers,
                waitingTimers,
                permissionTimers,
                send,
              );
            }
          } catch {
            /* file may not exist yet */
          }
        }, JSONL_POLL_INTERVAL_MS);
        jsonlPollTimers.set(p.id, pollTimer);
      }
    } catch {
      /* ignore */
    }
  }

  if (maxId >= nextAgentIdRef.current) nextAgentIdRef.current = maxId + 1;
  persistAgentsFn();

  if (restoredProjectDir) {
    ensureProjectScan(
      restoredProjectDir,
      knownJsonlFiles,
      projectScanTimerRef,
      activeAgentIdRef,
      nextAgentIdRef,
      agents,
      fileWatchers,
      pollingTimers,
      waitingTimers,
      permissionTimers,
      send,
      persistAgentsFn,
    );
  }
}

export function sendExistingAgents(
  agents: Map<number, AgentState>,
  send: (msg: unknown) => void,
): void {
  const agentIds: number[] = [];
  for (const id of agents.keys()) {
    agentIds.push(id);
  }
  agentIds.sort((a, b) => a - b);

  const folderNames: Record<number, string> = {};
  for (const [id, agent] of agents) {
    if (agent.folderName) {
      folderNames[id] = agent.folderName;
    }
  }

  send({
    type: 'existingAgents',
    agents: agentIds,
    agentMeta: {},
    folderNames,
  });

  // Re-send active tool statuses and waiting states
  for (const [agentId, agent] of agents) {
    for (const [toolId, status] of agent.activeToolStatuses) {
      const toolName = agent.activeToolNames.get(toolId);
      send({ type: 'agentToolStart', id: agentId, toolId, toolName, status });
    }
    if (agent.isWaiting) {
      send({ type: 'agentStatus', id: agentId, status: 'waiting' });
    }
  }
}
