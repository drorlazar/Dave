# Vendored OpenReel build

This directory is a **generated build artifact** — do not edit files here by hand.

- Upstream: https://github.com/Augani/openreel-video (MIT)
- Upstream commit: `2566c34e0f8ea22992a85f3ff16e048307b49365`
- Dave patch: `../openreel-bridge.patch`
- Built with a **relative base** (`OPENREEL_BASE=./`) so it works from any
  sub-path — `http://localhost:7777/vendor/openreel/` in dev and
  `https://drorlazar.github.io/Dave/vendor/openreel/` on GitHub Pages.
  The app uses hash routing, so no server rewrites are required.
- Served as a plain static directory out of the repo root; there is no
  `/openreel` alias.

## Rebuilding

```bash
git clone https://github.com/Augani/openreel-video
cd openreel-video
git checkout 2566c34e0f8ea22992a85f3ff16e048307b49365
git apply /path/to/Dave/vendor/openreel-bridge.patch

# corepack may be unavailable; npx works fine
npx pnpm@11 install --no-frozen-lockfile
npx pnpm@11 build:wasm
OPENREEL_BASE=./ npx pnpm@11 --filter @openreel/web build

rm -rf /path/to/Dave/vendor/openreel
mkdir -p /path/to/Dave/vendor/openreel
cp -R apps/web/dist/. /path/to/Dave/vendor/openreel/
```

Regenerate the patch after changing the OpenReel sources:

```bash
git add -N apps/web/src/bridges/external-import.ts
git diff > /path/to/Dave/vendor/openreel-bridge.patch
```

## What the patch does

| File | Change |
| --- | --- |
| `apps/web/src/bridges/external-import.ts` | New. BroadcastChannel(`dave-openreel`) bridge; feeds incoming `File` objects through `useProjectStore.getState().importMedia()` — the same path as the Import button and drag-and-drop. |
| `apps/web/src/main.tsx` | Calls `initExternalImportBridge()` on boot. |
| `apps/web/vite.config.ts` | Honours `OPENREEL_BASE` so the app can be served from a sub-path (Dave builds with `./`). |
| `apps/web/src/components/editor/preview/threejs-layer-renderer.ts` | 3D text fonts resolved against `import.meta.env.BASE_URL` instead of the site root. |
| `apps/web/public/manifest.json` | `start_url` and icon paths made relative. |
| `apps/web/src/services/service-worker.ts` | Registers the service worker at the deployment base instead of hardcoded `/`, so it does not claim Dave's whole origin. |
| `apps/web/public/sw.js` | Precache and SPA fallback paths made scope-relative. |

## Message contract

```
Dave     -> { type: 'dave:ping' }                    polled every 500ms
OpenReel -> { type: 'openreel:ready' }               on boot, and per ping
Dave     -> { type: 'dave:import', files: [File] }
OpenReel -> { type: 'openreel:imported', count }
OpenReel -> { type: 'openreel:import-error', error }
```

## COOP/COEP

Upstream's dev/preview servers send `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. Dave deliberately does **not** send
these headers for the vendored build, since COOP would sever the relationship
between the two tabs. The bridge uses BroadcastChannel, which is unaffected
either way. If a feature is ever found to hard-require `crossOriginIsolated`,
add the two headers scoped to `/vendor/openreel` only.
