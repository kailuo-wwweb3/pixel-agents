import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { WebSocket } from 'ws';

import {
  launchNewAgent,
  persistAgents,
  removeAgent,
  restoreAgents,
  sendExistingAgents,
} from './agentManager.js';
import type { LoadedAssets } from './assetLoader.js';
import {
  loadCharacterSprites,
  loadDefaultLayout,
  loadFloorTiles,
  loadFurnitureAssets,
  loadWallTiles,
} from './assetLoader.js';
import type { LayoutWatcher } from './layoutPersistence.js';
import {
  migrateAndLoadLayout,
  readLayoutFromFile,
  watchLayoutFile,
  writeLayoutToFile,
} from './layoutPersistence.js';
import type { AgentState } from './types.js';

const SETTINGS_FILE = path.join(os.homedir(), '.pixel-agents', 'settings.json');
const AGENT_SEATS_FILE = path.join(os.homedir(), '.pixel-agents', 'agent-seats.json');

function loadSettings(): { soundEnabled: boolean } {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return JSON.parse(raw) as { soundEnabled: boolean };
    }
  } catch {
    /* ignore */
  }
  return { soundEnabled: true };
}

function saveSettings(settings: { soundEnabled: boolean }): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Pixel Agents] Failed to save settings:', err);
  }
}

function loadAgentSeats(): Record<string, { palette?: number; seatId?: string }> {
  try {
    if (fs.existsSync(AGENT_SEATS_FILE)) {
      const raw = fs.readFileSync(AGENT_SEATS_FILE, 'utf-8');
      return JSON.parse(raw) as Record<string, { palette?: number; seatId?: string }>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveAgentSeats(seats: Record<string, unknown>): void {
  try {
    const dir = path.dirname(AGENT_SEATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AGENT_SEATS_FILE, JSON.stringify(seats, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Pixel Agents] Failed to save agent seats:', err);
  }
}

// Find the bundled assets root (same directory as this file when compiled,
// or the project root during development)
function findAssetsRoot(): string {
  // When running from compiled dist/server.js, assets are at dist/assets/
  const distAssets = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'dist',
    'assets',
  );
  if (fs.existsSync(distAssets)) {
    return path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
  }
  // Development: assets are in webview-ui/public/assets/ relative to server/src
  const devAssets = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    '..',
    'webview-ui',
    'public',
  );
  if (fs.existsSync(path.join(devAssets, 'assets'))) {
    return devAssets;
  }
  // Fallback: project root
  return path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
}

export class WsManager {
  nextAgentId = { current: 1 };
  agents = new Map<number, AgentState>();
  fileWatchers = new Map<number, fs.FSWatcher>();
  pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
  permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  activeAgentId = { current: null as number | null };
  knownJsonlFiles = new Set<string>();
  projectScanTimer = { current: null as ReturnType<typeof setInterval> | null };
  layoutWatcher: LayoutWatcher | null = null;
  workspaceFolders: string[];
  // Loaded assets (shared across connections, loaded once)
  private assetsLoaded = false;
  private cachedCharSprites: Awaited<ReturnType<typeof loadCharacterSprites>> = null;
  private cachedFloorTiles: Awaited<ReturnType<typeof loadFloorTiles>> = null;
  private cachedWallTiles: Awaited<ReturnType<typeof loadWallTiles>> = null;
  private cachedFurnitureAssets: LoadedAssets | null = null;
  private cachedDefaultLayout: Record<string, unknown> | null = null;
  // Active WebSocket connections
  private connections = new Set<WebSocket>();
  // Hooks called with a per-client send fn on each new webviewReady
  private onNewConnectionHooks: Array<(send: (msg: unknown) => void) => void> = [];

  constructor(workspaceFolders: string[]) {
    this.workspaceFolders = workspaceFolders;
  }

  /** Register a callback invoked for every new client that sends webviewReady. */
  registerOnNewConnection(hook: (send: (msg: unknown) => void) => void): void {
    this.onNewConnectionHooks.push(hook);
  }

  private persistAgents = (): void => {
    persistAgents(this.agents);
  };

  private send(ws: WebSocket, msg: unknown): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  /** Public: broadcast a message to all connected browser clients. */
  broadcastToAll(msg: unknown): void {
    this.broadcast(msg);
  }

  private broadcast(msg: unknown): void {
    for (const ws of this.connections) {
      this.send(ws, msg);
    }
  }

  private makeSend(_ws: WebSocket): (msg: unknown) => void {
    return (msg: unknown) => this.broadcast(msg);
  }

  async handleConnection(ws: WebSocket): Promise<void> {
    this.connections.add(ws);
    console.log(`[WsManager] New connection, total: ${this.connections.size}`);

    ws.on('message', (raw: Buffer | string) => {
      try {
        const message = JSON.parse(raw.toString()) as Record<string, unknown>;
        this.handleMessage(ws, message).catch(console.error);
      } catch (err) {
        console.error('[WsManager] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      this.connections.delete(ws);
      console.log(`[WsManager] Connection closed, total: ${this.connections.size}`);
    });
  }

  private async handleMessage(ws: WebSocket, message: Record<string, unknown>): Promise<void> {
    const send = this.makeSend(ws);

    if (message.type === 'webviewReady') {
      // Load assets if not yet loaded
      if (!this.assetsLoaded) {
        await this.loadAssets();
        this.assetsLoaded = true;
      }

      // Send assets in order
      if (this.cachedCharSprites) {
        this.send(ws, {
          type: 'characterSpritesLoaded',
          characters: this.cachedCharSprites.characters,
        });
      }
      if (this.cachedFloorTiles) {
        this.send(ws, { type: 'floorTilesLoaded', sprites: this.cachedFloorTiles.sprites });
      }
      if (this.cachedWallTiles) {
        this.send(ws, { type: 'wallTilesLoaded', sprites: this.cachedWallTiles.sprites });
      }
      if (this.cachedFurnitureAssets) {
        const spritesObj: Record<string, string[][]> = {};
        for (const [id, spriteData] of this.cachedFurnitureAssets.sprites) {
          spritesObj[id] = spriteData;
        }
        this.send(ws, {
          type: 'furnitureAssetsLoaded',
          catalog: this.cachedFurnitureAssets.catalog,
          sprites: spritesObj,
        });
      }

      // Send layout
      const layout = migrateAndLoadLayout(this.cachedDefaultLayout);
      this.send(ws, { type: 'layoutLoaded', layout });

      // Start layout watcher
      this.startLayoutWatcher();

      // Restore agents (JSONL watching only, no PTY)
      restoreAgents(
        this.nextAgentId,
        this.agents,
        this.knownJsonlFiles,
        this.fileWatchers,
        this.pollingTimers,
        this.waitingTimers,
        this.permissionTimers,
        this.jsonlPollTimers,
        this.projectScanTimer,
        this.activeAgentId,
        send,
        this.persistAgents,
        this.workspaceFolders,
      );

      // Send settings
      const settings = loadSettings();
      this.send(ws, { type: 'settingsLoaded', soundEnabled: settings.soundEnabled });

      // Send workspace folders
      if (this.workspaceFolders.length > 1) {
        this.send(ws, {
          type: 'workspaceFolders',
          folders: this.workspaceFolders.map((p) => ({ name: path.basename(p), path: p })),
        });
      }

      // Send existing agents
      const agentSeats = loadAgentSeats();
      const agentIds: number[] = [];
      for (const id of this.agents.keys()) agentIds.push(id);
      agentIds.sort((a, b) => a - b);
      const folderNames: Record<number, string> = {};
      for (const [id, agent] of this.agents) {
        if (agent.folderName) folderNames[id] = agent.folderName;
      }
      this.send(ws, {
        type: 'existingAgents',
        agents: agentIds,
        agentMeta: agentSeats,
        folderNames,
      });

      sendExistingAgents(this.agents, (msg) => this.send(ws, msg));

      // Announce any externally-tracked agents (e.g. mock sessions) to this client
      for (const hook of this.onNewConnectionHooks) {
        hook((msg) => this.send(ws, msg));
      }
    } else if (message.type === 'openClaude') {
      try {
        await launchNewAgent(
          this.nextAgentId,
          this.agents,
          this.activeAgentId,
          this.knownJsonlFiles,
          this.fileWatchers,
          this.pollingTimers,
          this.waitingTimers,
          this.permissionTimers,
          this.jsonlPollTimers,
          this.projectScanTimer,
          send,
          this.persistAgents,
          message.folderPath as string | undefined,
          this.workspaceFolders,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[WsManager] Failed to launch agent:', message);
        this.send(ws, { type: 'agentLaunchError', message });
      }
    } else if (message.type === 'focusAgent') {
      // In browser mode, "focusing" means selecting the agent
      this.activeAgentId.current = message.id as number;
      this.broadcast({ type: 'agentSelected', id: message.id });
    } else if (message.type === 'closeAgent') {
      const agentId = message.id as number;
      const agent = this.agents.get(agentId);
      if (agent) {
        removeAgent(
          agentId,
          this.agents,
          this.fileWatchers,
          this.pollingTimers,
          this.waitingTimers,
          this.permissionTimers,
          this.jsonlPollTimers,
          this.persistAgents,
        );
        this.broadcast({ type: 'agentClosed', id: agentId });
      }
    } else if (message.type === 'saveLayout') {
      this.layoutWatcher?.markOwnWrite();
      writeLayoutToFile(message.layout as Record<string, unknown>);
    } else if (message.type === 'saveAgentSeats') {
      saveAgentSeats(message.seats as Record<string, unknown>);
    } else if (message.type === 'setSoundEnabled') {
      const settings = loadSettings();
      settings.soundEnabled = message.enabled as boolean;
      saveSettings(settings);
    } else if (message.type === 'ptyInput') {
      const agentId = message.id as number;
      const agent = this.agents.get(agentId);
      if (agent) {
        try {
          agent.ptyInstance.write(message.data as string);
        } catch {
          /* ignore if PTY is dead */
        }
      }
    } else if (message.type === 'exportLayout') {
      const layout = readLayoutFromFile();
      this.send(ws, { type: 'exportLayoutResponse', layout });
    } else if (message.type === 'importLayout') {
      const imported = message.layout as Record<string, unknown>;
      if (imported.version !== 1 || !Array.isArray(imported.tiles)) {
        this.send(ws, { type: 'importLayoutError', error: 'Invalid layout file' });
        return;
      }
      this.layoutWatcher?.markOwnWrite();
      writeLayoutToFile(imported);
      this.broadcast({ type: 'layoutLoaded', layout: imported });
    }
  }

  private async loadAssets(): Promise<void> {
    const assetsRoot = findAssetsRoot();
    console.log('[WsManager] Loading assets from:', assetsRoot);

    this.cachedDefaultLayout = loadDefaultLayout(assetsRoot);

    try {
      this.cachedCharSprites = await loadCharacterSprites(assetsRoot);
      this.cachedFloorTiles = await loadFloorTiles(assetsRoot);
      this.cachedWallTiles = await loadWallTiles(assetsRoot);
      this.cachedFurnitureAssets = await loadFurnitureAssets(assetsRoot);
    } catch (err) {
      console.error('[WsManager] Error loading assets:', err);
    }
  }

  private startLayoutWatcher(): void {
    if (this.layoutWatcher) return;
    this.layoutWatcher = watchLayoutFile((layout) => {
      console.log('[Pixel Agents] External layout change — broadcasting to clients');
      this.broadcast({ type: 'layoutLoaded', layout });
    });
  }

  dispose(): void {
    this.layoutWatcher?.dispose();
    this.layoutWatcher = null;
    for (const id of [...this.agents.keys()]) {
      removeAgent(
        id,
        this.agents,
        this.fileWatchers,
        this.pollingTimers,
        this.waitingTimers,
        this.permissionTimers,
        this.jsonlPollTimers,
        this.persistAgents,
      );
    }
    if (this.projectScanTimer.current) {
      clearInterval(this.projectScanTimer.current);
      this.projectScanTimer.current = null;
    }
  }
}
