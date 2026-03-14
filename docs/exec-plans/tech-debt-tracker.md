# Tech Debt Tracker

<core_directive>
Agents should check this file when asked to "refactor" or "clean up." When fixing an item, remove it from the list.
</core_directive>

| Status | Component | Issue | Proposed Solution | Severity |
| :--- | :--- | :--- | :--- | :--- |
| Open | `transcriptParser.ts` | Currently uses rudimentary regex to parse LLM outputs. | Refactor to use a robust structured JSON parsing approach with fallback error handling. | High |
| Open | `gameLoop.ts` | Agent movement interpolation is strictly linear. | Implement easing functions (e.g., ease-in-out) for more organic starting and stopping visual feedback. | Low |
| Open | `TerminalPanel.tsx` | Does not auto-scroll reliably when new data arrives. | Implement a React `useRef` to track the bottom of the list and scroll automatically on dependency updates. | Medium |
| **Done** | `agentManager.ts` | `pty.spawn('claude', ...)` uses bare command name; fails when `~/.local/bin` is not in PATH (npx, GUI launches). Surfaces as `posix_spawnp failed`. | `resolveClaude()` runs `which claude` then checks known install locations before throwing a descriptive error. Fixed 2026-03-14. | High |
| **Done** | `wsManager.ts` + frontend | `launchNewAgent` errors swallowed by `.catch(console.error)` — browser receives no feedback when `+ Agent` fails. | Wrap in try/catch; send `agentLaunchError` WS message; show dismissible error banner in UI. Fixed 2026-03-14. | Medium |