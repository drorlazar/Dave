# Dave — Agent Handoff Document

Date: 2026-08-28. Written at the close of the video-editing work cycle (PRs #9, #10, #11,
all merged). Read this first, then skim the deeper references it points to.

## What Dave is

Dave (Dror's Assets Viewing Experience) is a fully client-side web app for viewing and
managing digital assets — images, video, audio, 3D models (GLB/FBX), fonts, documents —
in a grid layout. No build step, no bundler: plain ES6 modules loaded directly, with
Three.js and Font Awesome from CDN.

- **Live site**: https://drorlazar.github.io/Dave/ — GitHub Pages, auto-deploys from
  `main` via `.github/workflows/deploy.yml`. Merging to main IS publishing.
- **Local dev**: `node scripts/server.cjs` → http://localhost:7777/. Express, serves the
  repo root statically plus API routes.
- **Repo**: github.com/drorlazar/Dave (public). `main` is protected (code-owner review +
  signatures); merges need Dror or `gh pr merge N --merge --admin`.

## Architecture in one paragraph

`index.html` → `src/core/main.js` (hub) → `src/core/asset_loading.js` (heaviest module —
grid rendering, fullscreen viewers, per-type dispatch). `src/core/ui.js` owns toolbar,
selection, dropdowns, keyboard delegation, fullscreen exit paths. State lives in
`src/core/state.js` + module-level vars. Handlers under `src/handlers/` (factory pattern)
exist but are DISABLED (`useNewHandler = false` in asset_loading.js); the live dispatch
is the if/else chain in `showFullscreen()`. Viewers under `src/viewers/` (image viewer +
annotation, 3D inspectors, video editor). Cloud (S3/GDrive) under `src/cloud/`.
"Dave mode" personality system: `dave_mode.js` ↔ `dave_alive.js` (deliberate circular
dep), 14 `dave:*` custom events, `window.DaveMode` singleton.

**Deep references** (in `plans/`): `dave-knowledge-base_2026-02-22.md` is THE canonical
1000-line reference; `dave-design-language_2026-02-14.md` (visual rules);
`dave-persona-v1_2026-02-13.md` (voice — monospace, Dave green #00ff41, NO emoji ever).

## Video editing — current state (this cycle's work)

### 1. Built-in video editor (PR #9, merged)
Files: `src/viewers/video_editor.js` (orchestrator singleton), `video_timeline.js`,
`video_filters.js` (6 CSS filters), `video_crop.js` (8-handle + aspect presets +
Apply/Cancel), `video_export.js`; styles `src/styles/video_editor.css` (`.ve-*` prefix,
forced-dark chrome). Opens from a video tile's pencil button or expand (both route
through `showFullscreen()` → lazy import at `asset_loading.js` video branch).

- Trim ([ / ] with labeled In/Out buttons), loop, volume, J/K/L, frame stepping,
  `?` shortcut-help sheet, dirty-state confirm on close.
- Export: canvas + MediaRecorder, real-time pipeline (a 2-min clip takes 2 min; panel
  says so). Prefers MP4 (avc1+mp4a probed via `isTypeSupported`), WebM fallback;
  **audio support always wins over container**. Audio captured via AudioContext →
  MediaStreamAudioDestinationNode merged into the canvas captureStream.
- Concat/join was built, then REMOVED by product decision (commit 64dc4e0) — OpenReel
  is the multi-clip story now. Don't resurrect it.
- Deferred (queued in `plans/video-editor-revival_2026-08-28.md`): undo/redo, timeline
  thumbnails, ARIA/keyboard on timeline+crop handles, Pointer Events/touch.

### 2. OpenReel integration (PRs #10 + #11, merged)
"Edit video from selection" in the selection dropdown sends selected videos/images/audio
into a vendored copy of OpenReel (github.com/Augani/openreel-video, MIT, fully
client-side multi-track editor).

- Vendored build at `vendor/openreel/` (~34MB), opened at
  `vendor/openreel/index.html#/editor` **resolved against `document.baseURI`** — never
  use absolute `/...` paths; the live site lives under `/Dave/`.
- Bridge: `src/core/openreel_bridge.js`, `BroadcastChannel('dave-openreel')`.
  Contract: `dave:ping` (500ms poll) → `openreel:ready` → `dave:import {files:[File]}` →
  `openreel:imported {count}` | `openreel:import-error {error}`; 20s timeout with toast.
  BroadcastChannel (not window.opener postMessage) because OpenReel ships COOP/COEP.
- Non-local files are hydrated: `model.file` if present, else fetch from
  `model.remoteUrl` (remote-control API) or S3/GDrive via CloudStorageProvider, wrapped
  into `File` objects. The editor tab opens synchronously inside the click gesture
  (popup blockers).
- OpenReel source patch: `vendor/openreel-bridge.patch` + rebuild instructions in
  `vendor/openreel/README-DAVE.md`. Build: `OPENREEL_BASE=./` (relative base —
  mandatory). The patch also scope-fixes OpenReel's service worker (unpatched it would
  claim Dave's entire origin) and un-hardcodes `/fonts/` + manifest paths.

## Gotchas that will bite you

- **Paths must be base-relative.** Local server serves at `/`, production at `/Dave/`.
  Any absolute `/foo` reference works locally and 404s in production (this exact bug
  shipped and was fixed in PR #11). GitHub Pages CDN also caches hard — cache-bust when
  verifying deploys.
- **Video export**: real-time playback capture only — frame-seek loops produce
  slow-motion output. `style.display = ''` does NOT show an element whose stylesheet
  says `display:none`.
- **Video editor chrome auto-hides after 3s**; backdrop clicks must reveal chrome, not
  exit (deliberate — see ui.js fullscreenOverlay click handler).
- **OpenReel "Recover Your Work" dialog** can swallow an import that arrives while it's
  open; Dave then shows an honest timeout toast, re-trigger works. A queued-import fix
  in `external-import.ts` would be the proper cure.
- **Remote-control models** (`/api/control/show`) carry `remoteUrl`, not `file`.
- **Playwright e2e suite is broken on main** (Playwright rejects `test_config.js` /
  `test_utils.js` imports from test files — pre-existing config issue in `tests/e2e/`).
  Fix candidate: rename helpers so they don't match testMatch, or set testMatch
  explicitly. Until then, verification is manual/browser-driven.
- **Tests expect port 8080** (`PORT=8080 node scripts/server.cjs`); dev default is 7777.
- Image reading in agent sessions: never Read images >800px; downscale first (see
  Dror's global tool-constraints rules).

## Development workflow (Dror's conventions)

1. Feature branches off `main`, PR, Dror merges (or admin-merge when he says so).
2. **Every user-facing merge adds a release-log entry** in `src/cloud/SettingsModal.js`
   (`_releaseLogEntriesHTML`, newest first — currently 2.9.0 OpenReel, 2.8.0 editor).
3. Plans saved to `plans/<name>_<YYYY-MM-DD>.md` before implementing.
4. CSS naming `.prefix-*` per subsystem (`.ve-*` video editor, `.iv-*` image viewer).
   No emoji anywhere in product code or UI. Dark-first; light mode via forced-dark
   chrome for editor surfaces.
5. Useful test lever: `curl -X POST localhost:7777/api/control/show -H 'Content-Type:
   application/json' -d '{"files":["/abs/path/file.mp4"]}'` seeds files into the grid
   (remote-control API, `scripts/routes/control.cjs` + `src/core/remote_control.js`).

## Open threads / sensible next steps

- Video editor deferred list (undo/redo, timeline thumbnails, accessibility, touch).
- OpenReel: queue imports behind the recovery dialog; consider upstreaming the import
  bridge to Augani/openreel-video so the vendored patch shrinks; prune inert
  `_headers`/`_redirects` from the vendored dist at build time.
- Fix the Playwright suite config so e2e runs again.
- Promo video project (separate thread, see `plans/` promo files + memory): Remotion
  assembly exists, awaiting capture/music work — check with Dror before touching.

## Quick start for the next agent

```bash
node scripts/server.cjs        # → http://localhost:7777/
```
Load a folder (or use the remote-control curl above), hover a video tile → pencil =
built-in editor; select items → "0 Selected" dropdown → "Edit video from selection" =
OpenReel. Read `plans/dave-knowledge-base_2026-02-22.md` for everything else.
