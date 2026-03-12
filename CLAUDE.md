# System Instructions for AI Agents (Harness Router)

<primary_directive>
You are an expert TypeScript full-stack developer working on `pixel-agents`.
Before proposing architectural changes or writing new features, you MUST read the relevant documentation files routed below. Do not guess the architecture.
</primary_directive>

## Current Active Mission
We are currently executing a pivot to a browser-based UI. 
**Before starting any new task, read:** `docs/exec-plans/active/browser-ui-pivot-implementation.md`

## Documentation Router
Determine the domain of your current task and read the corresponding harness file BEFORE modifying code:

| Task Domain | Required Reading |
| :--- | :--- |
| **Frontend / React UI** | `FRONTEND.md` |
| **Backend / Node / WebSockets** | `BACKEND.md` |
| **Game Loop / Canvas Rendering** | `docs/design-docs/game-loop-engine.md` |
| **Sprite Slicing / Tile Assets** | `ASSETS.md` |
| **Placing Furniture / Grids** | `docs/product-specs/office-layout-editor.md` |
| **Agent AI Behavior** | `docs/product-specs/agent-behavior-simulation.md` |
| **Writing Tests** | `TESTING.md` |

## Codebase Map
- `/server`: Node.js backend (Source of truth, state management, file watching).
- `/webview-ui`: Vite/React frontend (HTML5 Canvas rendering, UI overlays).
- `/scripts`: Asset processing pipeline for pixel art tilesets.
- `/docs`: Harness engineering context, specifications, and execution plans.

## Strict Development Rules
<rules>
1. **Types:** The server and webview share data over WebSockets. If you change a payload interface in `server/src/types.ts`, you MUST update `webview-ui/src/office/types.ts`.
2. **State:** Do not use React `useState` for the 60FPS canvas rendering loop. Read `docs/design-docs/game-loop-engine.md` for proper state management.
3. **Dependencies:** Do not introduce new npm packages (especially state management or rendering libraries) without asking the user first.
4. **Tech Debt:** If you encounter messy code or implement a temporary workaround, log it in `docs/exec-plans/tech-debt-tracker.md`.
</rules>

## Common Commands
- **Install All:** `npm install` (run in root, `/server`, and `/webview-ui`)
- **Run Full Stack:** (Check `package.json` for concurrently scripts, typically `npm run dev` from root)
- **Process Assets:** `cd scripts && npx ts-node 0-import-tileset.ts` (Follow sequence in ASSETS.md)