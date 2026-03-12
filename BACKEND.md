# Backend Agent Guidelines (`server/`)

<core_directive>
The backend (`server/`) is a Node.js process responsible for managing the state of the simulation, coordinating pixel agent behaviors, and synchronizing data with the frontend via WebSockets.
</core_directive>

## Core Modules
- **Agent Manager:** `src/agentManager.ts` dictates the lifecycle and behavior of all simulated entities.
- **WebSocket Sync:** `src/wsManager.ts` handles broadcasting state updates to the React frontend. Ensure payloads are strictly typed according to `src/types.ts`.
- **File System:** The server watches local files via `src/fileWatcher.ts`. It parses transcripts (`transcriptParser.ts`) to drive agent actions.

## Mock Data Simulation
- The server utilizes `src/mockSessions.ts` to generate robust simulation data. Any changes to how agents move or interact should first be validated against these mock sessions before attempting live LLM integrations.

<anti_patterns>
- Do not place UI rendering logic or React-specific code in the `server/` directory.
- Do not mutate state directly within WebSocket message handlers; delegate to `agentManager` or specific state controllers.
</anti_patterns>