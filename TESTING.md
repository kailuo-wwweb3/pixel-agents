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

## Automated Verification Loop (Playwright)

<core_directive>
You are an autonomous agent. Do not ask the user to verify UI or Canvas rendering changes in their browser. You MUST verify them yourself using the headless Playwright suite before concluding your task.
</core_directive>

### Execution Steps
1. Navigate to the frontend directory: `cd webview-ui`
2. Run the test suite: `npm run test:e2e`

### How to handle Test Failures
- **Smoke Test Failures (`smoke.spec.ts`):** This means your code threw an uncaught exception or a `console.error` in the browser. Read the error trace provided in the terminal output, identify the bug in your React/Canvas code, fix it, and re-run the tests.
- **Visual Regressions (`canvas.spec.ts`):** If this fails, you broke the visual output of the canvas (e.g., incorrect math in `renderer.ts`, scaling issues in `officeState.ts`). DO NOT simply update the snapshot unless the explicit goal of the prompt was to change the visual layout. Fix your math and re-run.
- **Updating Snapshots:** ONLY if the user explicitly asked for a visual change (e.g., "Change the floor tile color"), run `npm run test:e2e:update` to save the new baseline, then proceed.