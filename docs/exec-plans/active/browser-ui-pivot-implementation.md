# Execution Plan: Browser UI Implementation

<context>
The project recently transitioned away from a terminal-native UI because the aesthetic fidelity of the mock data simulation phase did not meet expectations. The current active phase focuses heavily on ensuring the Vite/React browser-based UI (`webview-ui/`) successfully ingests the generated mock transcripts and renders them on the HTML5 canvas grid.
</context>

## Active Tasks
- [x] **Phase 1: WebSocket Integration Stabilization**
  - `wsManager.ts` correctly broadcasts tick-by-tick agent events (agentCreated, agentToolStart/Done, agentStatus, permission bubbles) via `broadcastToAll`. Mock sessions verified via `/api/dev/mock`.
  - `vscodeApi.ts` bridges WebSocket ↔ `window.dispatchEvent`, so `useExtensionMessages.ts` receives and parses all message types without desynchronization.
- [x] **Phase 2: Canvas Rendering Fidelity**
  - Agent positions are managed entirely on the frontend in `officeState.ts` (not sent from server). `renderer.ts` reads from `officeState` each frame — coordinate systems are in sync.
  - `gameLoop.ts` caps deltaTime (`Math.min(dt, MAX_DELTA_TIME_SEC)`) ensuring smooth interpolation without frame-rate-dependent jumps.
  - `TerminalPanel.tsx` streams raw PTY output via xterm; `transcriptParser.ts` drives canvas events (tool bubbles, agent states) separately — both pipelines verified.
- [x] **Phase 3: Layout & Polish**
  - `SettingsModal.tsx` and `BottomToolbar.tsx` are implemented and styled.
  - `ZoomControls.tsx` dispatches zoom actions that update `officeState` camera scale factors.

## Production Build Fix (completed 2026-03-12)
- **Problem:** `npm start` (`node dist/server.js`) failed because ESM resolves external packages relative to the bundle file, but server deps (`express`, `ws`, `node-pty`, `pngjs`) live in `server/node_modules/`.
- **Fix 1:** `build:server` now creates `dist/node_modules → ../server/node_modules` symlink so ESM finds all external packages.
- **Fix 2:** Updated Express v5 SPA fallback from `app.get('*', ...)` to `app.get('/{*splat}', ...)` (path-to-regexp v8 breaking change).

## Definition of Done ✅
The Node server boots `mockSessions.ts` via `POST /api/dev/mock`, and the React frontend (`npm start` → `http://localhost:3000`, or `npm run dev` → `http://localhost:5173`) flawlessly visualizes agents moving around the office grid while their tool activity drives canvas animations in real-time.
