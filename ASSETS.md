# Asset Pipeline Guidelines (`scripts/`)

<core_directive>
The `scripts/` directory contains a sequential pipeline for importing, slicing, detecting, and exporting 2D pixel art assets for the canvas renderer. Do not manually edit the generated JSON files in `.tileset-working/` unless debugging the pipeline itself.
</core_directive>

## The Pipeline Workflow
When adding new sprites or tiles, the agent must run the pipeline in this exact order:
1. `0-import-tileset.ts`: Ingests the raw sprite sheets.
2. `1-detect-assets.ts`: Slices the sheets into discrete usable items based on transparency boundaries.
3. `3-vision-inspect.ts`: (Optional) Uses LLM vision to automatically categorize detected assets (e.g., "desk", "chair").
4. `5-export-assets.ts`: Compiles the final `.tileset-working/tileset-metadata-final.json` into the static assets folders for the `webview-ui/` and `server/`.

## Manual Intervention
If automatic detection fails, use the provided HTML tools (e.g., `scripts/asset-manager.html` or `scripts/wall-tile-editor.html`) to manually adjust bounding boxes or categories before running step 5.

<anti_patterns>
- Do not bypass the script pipeline by directly placing new image slices into `webview-ui/public/assets/`. Always process them through `scripts/`.
</anti_patterns>