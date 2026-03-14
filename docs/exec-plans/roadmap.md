# Product Roadmap: The Claude Code Visualizer

## Phase 1: The "Zero-Config" MVP (Log & File Sync)
**Focus:** How do we know what Claude Code is doing without making the user rewrite their workflow?
- [x] **Build a File/Log Watcher:** `server/src/fileWatcher.ts` tails Claude Code's JSONL transcript files; `transcriptParser.ts` parses tool_use events to drive agent state.
- [x] **Action Mapping:** Raw tool events map to visual animations via `READING_TOOLS` in `characters.ts` and `isReadingTool()`. `agentToolStart` now carries `toolName` directly so the frontend doesn't need to reverse-parse the status string.
  - *`Write`/`Edit`/`NotebookEdit` → Avatar types at desk.*
  - *`Read`/`Glob`/`Grep` → Avatar uses reading animation (filing cabinet).*
  - *`turn_duration` + silence → Avatar idles (waiting state).*
- [x] **CLI Wrapper:** `bin/pixel-agents.js` registered as `"bin"` in `package.json`. Running `npx pixel-agents start` boots the server (built dist or source via tsx) and auto-opens the browser when the server is ready. 23 unit + integration tests in `bin/cli.test.js` (`npm run test:cli`).

## Phase 2: The "Fun" Layer (Customization & Vibe)
**Focus:** Enhancing the Tamagotchi experience.
- [ ] **Thought Bubbles:** Parse the LLM's internal reasoning (the text before the code block) and display it as comic-book-style thought bubbles above the pixel avatar.
- [ ] **Environment Interaction:** Make the avatar interact with the furniture. If they successfully finish a task, they should do a victory dance or play an arcade machine in the breakroom.
- [ ] **Multiple Agents:** If the user spins up two terminal windows with two different agents, render two avatars in the office working simultaneously.

## Phase 3: Developer God Mode (Bi-directional Interaction)
**Focus:** Going from a passive visualizer to an active workspace tool.
- [ ] **UI-to-Terminal Commands:** Allow the developer to click the avatar and type "Stop" or "Undo," which securely sends the corresponding interrupt signal back to the local Claude Code terminal process.
- [ ] **Office Upgrades:** Gamify the experience. The longer the agent works without errors, the more "credits" the developer earns to buy better pixel art desks, plants, or pets for the virtual office.