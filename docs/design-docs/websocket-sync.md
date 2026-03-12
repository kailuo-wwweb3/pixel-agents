# WebSocket Synchronization

<core_directive>
The WebSocket connection is the sole artery of state between the `server` and the `webview-ui`. Data flows one-way for simulation (Server -> Client) and one-way for layout editing (Client -> Server).
</core_directive>

## Payloads
- **Server to Client (Simulation Tick):** Sent every fixed interval from `wsManager.ts`. Contains an array of active agents, their exact grid `(x, y)` coordinates, their current action state (walking, typing, talking), and any new transcript dialogue.
- **Client to Server (Layout Updates):** Dispatched from `webview-ui` when a user edits the grid (e.g., places a new desk using `furnitureCatalog.ts`). Caught by `server/src/layoutPersistence.ts` to save the new JSON layout.

## Shared Typings
To prevent parsing errors, both environments must strictly adhere to the types defined in their respective directories (`server/src/types.ts` and `webview-ui/src/office/types.ts`). 
- **Agent Rule:** If you add a property to an agent (e.g., `isSleeping: boolean`), you MUST update the interfaces in both the server and the webview directories simultaneously.