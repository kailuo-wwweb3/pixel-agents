# Architecture Overview

The `pixel-agents` repository utilizes a split architecture to separate simulation logic from rendering.

## 1. The Server (`/server`)
A Node.js process acting as the source of truth.
- **Role:** Loads assets (`assetLoader.ts`), parses transcripts (`transcriptParser.ts`), and manages the passage of time (`timerManager.ts`).
- **Communication:** Pushes state out via `wsManager.ts`. It does not know or care how the frontend renders the data.

## 2. The Frontend (`/webview-ui`)
A Vite/React SPA.
- **Role:** Consumes WebSocket data and paints it to a high-performance 2D Canvas (`OfficeCanvas.tsx`).
- **Tools:** Provides user controls (`EditorToolbar.tsx`, `ZoomControls.tsx`) layered on top of the canvas using standard React DOM rendering.

## The Bridge
Strict typing is enforced between the two via shared interfaces (found in `server/src/types.ts` and `webview-ui/src/office/types.ts`). Any modifications to the data payload structure must be updated in both domains simultaneously.