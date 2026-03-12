# Tech Debt Tracker

<core_directive>
Agents should check this file when asked to "refactor" or "clean up." When fixing an item, remove it from the list.
</core_directive>

| Component | Issue | Proposed Solution | Severity |
| :--- | :--- | :--- | :--- |
| `transcriptParser.ts` | Currently uses rudimentary regex to parse LLM outputs. | Refactor to use a robust structured JSON parsing approach with fallback error handling. | High |
| `gameLoop.ts` | Agent movement interpolation is strictly linear. | Implement easing functions (e.g., ease-in-out) for more organic starting and stopping visual feedback. | Low |
| UI Overlays | `TerminalPanel.tsx` does not auto-scroll reliably when new data arrives. | Implement a React `useRef` to track the bottom of the list and scroll automatically on dependency updates. | Medium |