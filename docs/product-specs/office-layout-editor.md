# Product Spec: Office Layout Editor

<context>
The `webview-ui` allows users to design the physical environment that the simulated agents will inhabit. It functions like a lightweight isometric/top-down map editor.
</context>

## Core Features
- **Grid Snapping:** All walls, floors, and furniture must perfectly snap to the defined grid size (referenced in `constants.ts`).
- **Tool Modes:** The editor operates in discrete modes (Draw Wall, Erase, Place Furniture). These modes are managed by `useEditorActions.ts` and reflected in `ToolOverlay.tsx`.
- **Persistence:** Layouts must be serializable. When the user hits "Save," the client sends a layout payload to the server, which is handled by `layoutPersistence.ts` and saved as `default-layout.json` (or similar).

## Constraints
- Furniture cannot overlap walls or other solid furniture objects.
- The map must have defined outer boundaries so pathfinding algorithms on the server do not calculate routes into the void.