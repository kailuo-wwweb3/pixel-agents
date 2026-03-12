# Execution Plan: Browser UI Implementation

<context>
The project recently transitioned away from a terminal-native UI because the aesthetic fidelity of the mock data simulation phase did not meet expectations. The current active phase focuses heavily on ensuring the Vite/React browser-based UI (`webview-ui/`) successfully ingests the generated mock transcripts and renders them on the HTML5 canvas grid.
</context>

## Active Tasks
- [ ] **Phase 1: WebSocket Integration Stabilization**
  - Verify `wsManager.ts` on the Node server correctly broadcasts the tick-by-tick state of the mock sessions.
  - Ensure `useExtensionMessages.ts` inside the React app catches and parses these updates without desynchronizing.
- [ ] **Phase 2: Canvas Rendering Fidelity**
  - Map `agentManager.ts` positional data to the `renderer.ts` coordinate system.
  - Implement smooth interpolation in `gameLoop.ts` so agents do not visually jump between tiles.
  - Ensure the `TerminalPanel.tsx` overlay correctly parses and formats the output of `transcriptParser.ts`.
- [ ] **Phase 3: Layout & Polish**
  - Finalize styling for `SettingsModal.tsx` and `BottomToolbar.tsx`.
  - Verify the `ZoomControls.tsx` interact correctly with the `officeState.ts` scaling factors.

## Definition of Done
The Node server can boot `mockSessions.ts`, and the React frontend flawlessly visualizes the agents moving around the office grid while their internal monologues print accurately in the side terminal panel.