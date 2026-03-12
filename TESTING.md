# Testing Strategy

<core_directive>
Because of the split architecture (Node.js server vs. React/Canvas frontend) and the heavy reliance on WebSocket timing, tests must be explicitly scoped to their domain.
</core_directive>

## Backend Testing (`server/`)
- Focus on unit testing the pure logic functions: `transcriptParser.ts` (ensuring LLM text output maps correctly to agent actions) and `agentManager.ts` (verifying pathfinding and state updates).
- **Rule:** Do not mock the file system if testing `fileWatcher.ts`; use dedicated fixture directories.

## Frontend Testing (`webview-ui/`)
- **React Components:** Use standard React Testing Library patterns for the UI overlays (`SettingsModal.tsx`, `BottomToolbar.tsx`).
- **Canvas Rendering:** Do NOT attempt to unit test the HTML5 Canvas pixel output. Instead, test the state management in `officeState.ts` and ensure the math in `editorActions.ts` yields the correct grid coordinates.

## Mock Data
Rely heavily on `mockSessions.ts` to simulate edge cases (e.g., 50 agents moving simultaneously) to profile performance before committing changes.