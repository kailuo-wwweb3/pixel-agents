# Frontend Agent Guidelines (`webview-ui/`)

<core_directive>
The frontend is a React application built with Vite (`webview-ui/`). It serves as a visualizer and layout editor for the Pixel Agents simulation. It does NOT handle heavy simulation logic; it reflects state received via IPC/WebSockets.
</core_directive>

## Rendering Engine Rules
- **Canvas vs. React:** The core office visualization is rendered on an HTML5 `<canvas>` via `src/office/components/OfficeCanvas.tsx`. Do NOT attempt to render the grid, walls, or sprites using standard DOM elements (like `<div>` or `<img>`).
- **Engine Loop:** All canvas updates must go through `src/office/engine/gameLoop.ts` and `renderer.ts`. 
- **State Management:** Use `officeState.ts` for managing the spatial state of the canvas. Do not clutter standard React `useState` hooks with high-frequency game loop data.

## UI Components
- React components (`src/components/`) are strictly for overlays, menus, and tools (e.g., `SettingsModal.tsx`, `BottomToolbar.tsx`, `TerminalPanel.tsx`).
- Extension messaging must route through `src/hooks/useExtensionMessages.ts`.

<anti_patterns>
- Do not add direct DOM manipulation outside of React components.
- Do not import Node.js built-in modules (`fs`, `path`) into the `webview-ui/` codebase.
</anti_patterns>