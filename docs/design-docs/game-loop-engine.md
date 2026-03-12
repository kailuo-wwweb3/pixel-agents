# Game Loop Engine Design

<context>
The frontend visualization uses a classic game loop architecture rather than React-driven rendering to maintain 60FPS when drawing hundreds of sprites and grid tiles.
</context>

## Component Breakdown

1. **`gameLoop.ts` (The Ticker)**
   - Uses `requestAnimationFrame` to drive the update cycle.
   - Calculates `deltaTime` to ensure smooth interpolation of agent movements regardless of monitor refresh rate.
   - **Agent Rule:** Never put blocking asynchronous calls (like `fetch` or complex JSON parsing) inside the `update` or `draw` phases of the game loop.

2. **`officeState.ts` (The Source of Truth)**
   - Holds the highly mutable spatial data: camera zoom, pan offsets, agent positions, and the current office layout map.
   - Kept outside of React state to prevent cascading re-renders of the DOM.

3. **`renderer.ts` (The Painter)**
   - Exclusively handles taking data from `officeState.ts` and issuing `CanvasRenderingContext2D` draw calls.
   - Applies the camera transformations (scale and translate) before drawing the floor (`floorTiles.ts`), walls (`wallTiles.ts`), and entities.

<file_references>
- Entry point: `webview-ui/src/office/engine/index.ts`
- React bindings: `webview-ui/src/office/components/OfficeCanvas.tsx`
</file_references>