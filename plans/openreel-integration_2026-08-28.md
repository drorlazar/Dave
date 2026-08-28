# OpenReel Integration — "Edit video from the selection" — 2026-08-28

Branch: feat/openreel-integration (stacked on claude/dave-video-editing-feature-745ba3).

## Goal
User selects files in Dave's grid (videos, images, audio), picks a new selectionDropdown
option "Edit video from selection" → OpenReel (self-hosted, same origin) opens with those
files already imported into its media library.

## Findings
- Hosted app.openreel.video has NO import API (picker/drag-drop only) → must self-host.
- Repo: github.com/Augani/openreel-video (MIT). pnpm monorepo; web app = apps/web (Vite,
  React/TS); wasm is AssemblyScript (`asc`, npm devDep — no emscripten needed).
- App ships COOP:same-origin + COEP:require-corp headers. COOP would sever window.opener
  between Dave (no COOP) and OpenReel → bridge must use **BroadcastChannel**, not opener
  postMessage. No SharedArrayBuffer usage found in web/core src → try serving WITHOUT
  COOP/COEP first; add headers only if something breaks (and keep BroadcastChannel either way).
- Media import entry: apps/web/src/bridges/media-bridge.ts (same path as picker/drag-drop).

## Design
1. **OpenReel patch** (small, reapplicable): new apps/web/src/bridges/external-import.ts,
   imported from main.tsx. On boot: `new BroadcastChannel('dave-openreel')`, post
   `{type:'openreel:ready'}`, listen for `{type:'dave:import', files: File[]}` → feed each
   File through the same import function the picker uses. Keep the patch as a .patch file
   committed in Dave (vendor/openreel-bridge.patch) for future OpenReel upgrades.
2. **Vendor**: build `apps/web` → commit static dist to Dave `vendor/openreel/`.
3. **Serve**: scripts/server.cjs → express.static('vendor/openreel') at `/openreel/`
   (correct wasm MIME; no COOP/COEP unless required).
4. **Dave side**: selectionDropdown gains "Edit video from selection" → collect selected
   models' File objects (video/image/audio only) → `window.open('/openreel/#/editor')` →
   on `openreel:ready` via BroadcastChannel, send files; timeout + toast if no ready in ~15s.

## Ship path
Build → verify import flow in browser → commit (dist + patch + Dave changes) → PR.
