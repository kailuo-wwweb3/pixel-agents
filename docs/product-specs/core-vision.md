# Core Product Vision: Pixel Agents (The Claude Code Visualizer)

<target_audience>
- Software Engineers running local AI coding agents (specifically CLI-based agents like Claude Code, Aider, or Cursor).
- They want a passive, relaxing, and fun way to monitor their AI's progress without staring at a terminal wall-of-text.
</target_audience>

<value_proposition>
A zero-friction, drop-in visualizer. By running a single local command alongside their Claude Code session, developers get a browser-based, isometric pixel office where a virtual avatar "acts out" what the AI is currently doing (e.g., typing at a desk when writing code, searching a filing cabinet when reading files, or looking confused when encountering an error).
</value_proposition>

<core_vibe>
- **Fun & Passive:** It should feel like a screen saver or a simulation game (like The Sims or Habbo Hotel) that you leave open on a second monitor.
- **Tamagotchi-esque:** The developer should feel an emotional connection to their hard-working little agent.
</core_vibe>

<architectural_constraints>
- **No Custom Agent Logic:** We do NOT run the LLM. 
- **The Ingestion Strategy:** We must bridge the gap between the terminal (where Claude Code runs) and our Node server. We should prioritize reading local system events (e.g., tailing Claude's log files, or watching the file system for changes) rather than asking the user to modify their LLM scripts.
</architectural_constraints>