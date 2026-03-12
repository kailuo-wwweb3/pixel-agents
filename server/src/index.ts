import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import { readLayoutFromFile } from './layoutPersistence.js';
import type { MockSessionHandle } from './mockSessions.js';
import { startMockSessions } from './mockSessions.js';
import { WsManager } from './wsManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI flags
const workspaceFolders: string[] = [];
let mockCount = 0;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--workspace' && args[i + 1]) {
    workspaceFolders.push(args[++i]);
  } else if (args[i] === '--mock') {
    mockCount = Math.min(Math.max(1, Number(args[i + 1] ?? 3)), 8);
    if (!isNaN(mockCount) && args[i + 1]) i++;
    else mockCount = 3;
  }
}
if (workspaceFolders.length === 0) {
  workspaceFolders.push(process.cwd());
}
console.log('[Server] Workspace folders:', workspaceFolders);

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const app = express();
app.use(express.json({ limit: '50mb' }));

// Serve static webview files
const webviewDist = path.join(__dirname, '..', 'dist', 'webview');
if (fs.existsSync(webviewDist)) {
  app.use(express.static(webviewDist));
  // SPA fallback
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(webviewDist, 'index.html'));
  });
}

// REST API
app.get('/api/workspaces', (_req, res) => {
  res.json(workspaceFolders.map((p) => ({ name: path.basename(p), path: p })));
});

app.get('/api/layout', (_req, res) => {
  const layout = readLayoutFromFile();
  res.json(layout);
});

// ── Dev: mock sessions ───────────────────────────────────────
let activeMock: MockSessionHandle | null = null;

app.post('/api/dev/mock', (req, res) => {
  const count = Math.min(Math.max(1, Number((req.body as { count?: number }).count ?? 3)), 8);
  if (activeMock) {
    activeMock.stop();
    activeMock = null;
  }
  activeMock = startMockSessions((msg) => wsManager.broadcastToAll(msg), count);
  res.json({ ok: true, agentIds: activeMock.agentIds });
});

app.delete('/api/dev/mock', (_req, res) => {
  if (activeMock) {
    activeMock.stop();
    activeMock = null;
  }
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log(`[Server] Open http://localhost:${PORT} in your browser`);
});

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });
const wsManager = new WsManager(workspaceFolders);

wss.on('connection', (ws) => {
  wsManager.handleConnection(ws).catch(console.error);
});

// Auto-start mock sessions if --mock flag was provided
if (mockCount > 0) {
  console.log(`[Server] Auto-starting ${mockCount} mock agent(s)...`);
  activeMock = startMockSessions((msg) => wsManager.broadcastToAll(msg), mockCount);
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  wsManager.dispose();
  process.exit(0);
});
