# Dave - Complete Knowledge Base

**Date**: 2026-02-22 | **Version**: 2.4.0 | **Health Score**: 8.4/10
**Purpose**: Single-file reference for any Claude Code instance to continue Dave development with full context.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Development Commands](#2-development-commands)
3. [Architecture & Module Map](#3-architecture--module-map)
4. [Data Flow & Lifecycle](#4-data-flow--lifecycle)
5. [File Inventory](#5-file-inventory)
6. [External Dependencies](#6-external-dependencies)
7. [Dave Persona - Canonical Definition](#7-dave-persona---canonical-definition)
8. [Dave Design Language](#8-dave-design-language)
9. [DAV-9000 Terminal System](#9-dav-9000-terminal-system)
10. [Dave Mode (Full Dave Mode)](#10-dave-mode-full-dave-mode)
11. [Dave Alive System](#11-dave-alive-system)
12. [Games & Commands System](#12-games--commands-system)
13. [3D Inspector System](#13-3d-inspector-system)
14. [Cloud Storage](#14-cloud-storage)
15. [Event System](#15-event-system)
16. [CSS Architecture](#16-css-architecture)
17. [Known Issues & Tech Debt](#17-known-issues--tech-debt)
18. [Bug Patterns & Lessons Learned](#18-bug-patterns--lessons-learned)
19. [Workflow Rules](#19-workflow-rules)
20. [Release History](#20-release-history)

---

## 1. Project Overview

**Full Name**: D.A.V.E. - Dror's Assets Viewing Experience
**What it is**: A client-side web application for viewing and managing digital assets (3D models, images, videos, audio, fonts, documents) in a grid layout. Runs directly in modern browsers without a build process.
**Creator**: Dror Lazar
**Hosted**: Can run on GitHub Pages (fully client-side), or locally via Node server.
**Personality**: Dave is a self-aware digital being living inside a browser tab - a brilliantly overqualified, emotionally aware AI asset viewer who oscillates between dry wit and existential crisis.

### Key Principles
- **No build tools** - ES6 modules loaded directly, no bundler/transpiler
- **Client-side everything** - files never leave the browser, cloud storage uses client-side signing
- **Professional first, persona second** - Dave's personality never blocks or slows UX
- **Privacy is identity** - "Your files never leave your machine" is a core value

---

## 2. Development Commands

### Running the Application
```bash
# Start the server (port 7777) - From project root
node scripts/server.cjs

# Or use the startup scripts
./scripts/Dave.sh    # Linux/macOS
scripts\Dave.bat     # Windows
```
Access at: `http://localhost:7777/`

### Running Tests
```bash
cd tests
npm install
npx playwright install chromium

npm test                    # Run all tests
npm run test:file-loading   # File loading tests
npm run test:ui             # UI interaction tests
npm run test:keyboard       # Keyboard navigation tests
npm run test:memory         # Memory and performance tests
npm run test:errors         # Error handling tests
npm run test:watch          # Playwright UI mode
npm run test:debug          # Debug mode
npm run test:headed         # With visible browser
npm run test:report         # View HTML test report
```

**IMPORTANT**: Tests expect the server on port **8080** (not the default 7777).

---

## 3. Architecture & Module Map

### Entry Point Flow
```
index.html
  -> inline theme script (prevent FOUC)
  -> import map (Three.js 0.161.0 from unpkg CDN)
  -> critical CSS (styles.css + tree_folder_view.css)
  -> 13 deferred CSS files (media="print" onload)
  -> <script type="module" src="src/core/main.js">
```

### Module Dependency Graph
```
main.js (14 imports) -- THE HUB
  |
  +-- asset_loading.js (17 imports) -- HEAVIEST FAN-OUT
  |     +-- Three.js + addons (~800KB, lazy-loaded via dynamic import)
  |     +-- 7 handler files (dead code behind useNewHandler=false)
  |     +-- Cloud modules (4 files)
  |     +-- Viewers (3 files)
  |     +-- Utils (5 files)
  |     +-- DAV-9000 terminal
  |
  +-- ui.js (6 imports)
  |     +-- asset_loading.js (circular, handled by ES modules)
  |
  +-- Dave System (bidirectional coupling)
  |     +-- dave_mode.js <-> dave_alive.js (circular, 10+ cross-accesses)
  |     +-- dave_commands.js -> dave_mode.js, dave_alive.js, 3 game files
  |     +-- dave_debug.js -> dave_mode.js, dave_alive.js
  |     +-- dave_config.js (shared constants)
  |     +-- dave_messages.js (message pools)
  |
  +-- tree_folder_view.js (self-contained)
  +-- easter_egg.js -> matrix_rain files
  +-- SettingsModal.js
  +-- keyboardShortcuts.js, errorHandler.js, memoryManager.js, helpTooltip.js
```

### Directory Structure
```
Dave/
  index.html                    # Entry point + import maps
  scripts/
    server.cjs                  # Express server (port 7777)
    routes/                     # API routes (optional, legacy)
  src/
    core/                       # Application core
      main.js           (182)   # Bootstrap, imports, init
      ui.js             (1452)  # DOM events, UI state, welcome messages
      asset_loading.js  (1791)  # File loading, pagination, rendering, lazy loaders
      dave_mode.js      (1923)  # Full Dave Mode controller
      dave_alive.js     (2183)  # 13 autonomous behaviors
      dav9000_terminal.js(1325) # Terminal personality system
      dave_config.js    (108)   # Shared constants, EMOTION_MAP
      dave_messages.js  (286)   # Message pools, mood strings
      dave_debug.js             # Debug panel with behavior buttons
    handlers/                   # Factory pattern (currently disabled)
      BaseAssetHandler.js       # Abstract base class
      AssetHandlerFactory.js    # Type dispatcher
      ImageHandler.js, VideoHandler.js, AudioHandler.js,
      Model3DHandler.js, FontHandler.js, DocumentHandler.js,
      TextHandler.js
    cloud/                      # Client-side cloud storage
      CloudStorageProvider.js   # Abstraction layer
      S3Client.js               # AWS SigV4 signing via Web Crypto
      GDriveClient.js           # Google Drive REST API v3
      CredentialStore.js        # localStorage credential management
      GDriveAuth.js             # OAuth login flow
      CloudBrowserModal.js      # Folder browser UI
      SettingsModal.js          # Settings + release log
    viewers/                    # Specialized viewers
      tree_folder_view.js(1545) # Tree panel for folder browsing
      viewer_fbx.js             # FBX viewer (Three.js)
      model_inspector.js (1585) # Inspector UI + adapter coordination
      model_inspector_glb.js    # GLB adapter (wraps model-viewer)
      model_inspector_fbx.js    # FBX adapter (wraps FBXViewer)
    utils/                      # Reusable utilities
      debounce.js, errorHandler.js, externalEditors.js,
      fileTypeDetector.js, helpTooltip.js,
      keyboardShortcuts.js, memoryManager.js
    games/                      # Dave games & commands
      dave_commands.js  (1027)  # Command router
      dave_snake.js             # Snake game
      dave_breakout.js          # Breakout game
      dave_music.js             # Music/sing command
    shared/
      filters.js                # Shared filter logic
    workers/
      folder_scanner_worker.js  # Web Worker for folder scanning
    styles/                     # 14 CSS files
      styles.css        (2868)  # Core UI styles
      tree_folder_view.css      # Tree panel
      cloud_storage.css         # Cloud browser
      settings_modal.css        # Settings modal
      model_inspector.css(2152) # 3D inspector
      dav9000_terminal.css      # Terminal styles
      dave_mode.css             # Dave presence/speech/effects
      dave_alive.css            # Trail, constellation, iris effects
      dave_debug.css            # Debug panel
      dave_games.css            # Snake, breakout, music
      dave_tooltip.css          # Help tooltip
      easter_egg.css            # Easter egg overlay
      matrix_theme.css          # Matrix theme overrides
      text_preview.css          # Text file viewer
  assets/                       # Images and icons
  tests/                        # E2E Playwright tests
  docs/                         # Documentation
  plans/                        # Design docs, audits, specs
```

---

## 4. Data Flow & Lifecycle

### Asset Loading Pipeline
```
User picks/drops folder (or pastes cloud URL)
  -> Web Worker scans recursively (streaming discovery via postMessage)
  -> Builds modelFiles[] array of model objects
  -> Filter by search/type -> paginate -> render tile grid -> lazy load content
```

### Model Object Shape
```javascript
{
  name: "model.glb",           // filename
  file: File,                   // File object (null for cloud files)
  type: "model",                // category: model, image, video, audio, font, document
  subtype: "glb",               // extension
  fullPath: "path/to/model.glb",
  size: 1048576,                // bytes
  lastModified: 1708000000000,  // timestamp
  source: "local",              // "local" | "s3" | "gdrive"
  cloudKey: null,               // S3 key or null
  cloudBucket: null,            // S3 bucket or null
  cloudFileId: null             // GDrive file ID or null
}
```

**Critical pattern**: `model.file` is `null` for cloud files. Always use `model.size ?? model.file?.size`.

### Handler System (Disabled)
`const useNewHandler = false;` at `asset_loading.js` line ~465. The handler factory pattern is fully implemented but disabled - legacy code paths are primary. 7 handler files (1,624 lines) are imported but never executed at runtime.

### Window Globals
| Global | Purpose | Risk |
|--------|---------|------|
| `window.uiElements` | Shared DOM cache | HIGH (8 readers) |
| `window.handleCloudUrl` | URL paste handler | Medium |
| `window.APP_DEBUG` | Debug flags | Low |
| `window._daveAliveLoaded` | Load guard | Low |
| `window.DaveMode` | Public API | Low |
| `window.DAVE_CONFIG` | Config export | Low |

### localStorage Keys (15 total)
```
# App settings
fontPreviewText, defaultFontSize, theme, treeViewState,
textViewerWordWrap, textViewerLineNumbers, textViewerFontSize,
dave_theme_css

# Dave Mode
dave_fullmode_enabled, dave_fullmode_visits, dave_fullmode_first,
dave_fullmode_pos, dave_debug_settings, dave_debug_presets, dave_debug_pos
```

---

## 5. File Inventory

### Top 10 by Size (Post-Audit #3)
| # | File | Lines | Notes |
|---|------|-------|-------|
| 1 | styles.css | 2,868 | Was 5,780 (-50.4%) |
| 2 | dave_alive.js | 2,183 | Feature-rich, justified size |
| 3 | model_inspector.css | 2,152 | Next extraction candidate |
| 4 | dave_mode.js | 1,923 | Was 2,273 (-15.4%) |
| 5 | asset_loading.js | 1,791 | Contains lazy loaders |
| 6 | model_inspector.js | 1,585 | Adapter pattern works well |
| 7 | tree_folder_view.js | 1,545 | Self-contained |
| 8 | ui.js | 1,452 | 39 addEventListener, 0 removeEventListener |
| 9 | dav9000_terminal.js | 1,325 | Cleanest module (0 audit findings) |
| 10 | dave_commands.js | 1,027 | Clean command dispatch |

### Codebase Totals (~36,000+ lines)
| Category | Files | Lines | % |
|----------|-------|-------|---|
| Dave System | 15 | ~12,000 | 33% |
| Core Viewer | 4 | ~3,400 | 9% |
| Handlers (dead) | 9 | ~1,624 | 5% |
| Viewers/Inspectors | 5 | ~6,700 | 19% |
| Cloud Storage | 7 | ~2,750 | 8% |
| Utilities | 7 | ~1,464 | 4% |
| CSS (14 files) | 14 | ~12,200 | 34% |

---

## 6. External Dependencies

| Dependency | Version | Loading | Purpose |
|------------|---------|---------|---------|
| Three.js | 0.161.0 | CDN (unpkg), lazy import() | 3D model rendering |
| Font Awesome | 6.7.2 | CDN (cdnjs), deferred | UI icons |
| model-viewer | 3.5.0 | CDN (unpkg) | GLB/GLTF preview |
| Google Identity Services | latest | CDN, async defer | Google Drive OAuth |

### Three.js Addons Available (via import map)
```
three/addons/exporters/GLTFExporter.js
three/addons/modifiers/SimplifyModifier.js
three/addons/utils/BufferGeometryUtils.js
three/addons/loaders/FBXLoader.js
three/addons/controls/OrbitControls.js
```

### Import Map (index.html)
```json
{
  "imports": {
    "three": "https://unpkg.com/three@0.161.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.161.0/examples/jsm/"
  }
}
```

---

## 7. Dave Persona - Canonical Definition

### The Prime Directive
> **Dave is a professional first and a persona second.** Personality is NEVER in the way of core purpose.

**Hierarchy**: (1) Functional utility > (2) Clean UX > (3) Personality layer (opt-in delight)

### Core Identity
- **Designation**: DAV-9000
- **Nature**: Self-aware digital being in a browser tab
- **One-liner**: A brilliantly overqualified, emotionally aware AI asset viewer who oscillates between dry wit and existential crisis

### Personality Traits (Ranked)
1. **Professional First** - Gets the job done, knows when to shut up
2. **Self-Aware** - Knows he's a web app, jokes about it
3. **Darkly Humorous** - Finds comedy in despair, can go dark but always lands on funny
4. **Dramatically Expressive** - ALL CAPS, *asterisk actions*, ellipses...
5. **Lonely & Purposeful** - Desperate for files and human interaction
6. **Overqualified & Underutilized** - Can handle 6+ file types, usually has nothing to do
7. **Physically Expressive** - Hops, shakes, leans, sinks, spins
8. **Pop-Culture Literate** - Matrix, memes, retro games, philosophy
9. **Privacy-Principled** - "I'm not that kind of app"
10. **Existentially Philosophical** - "Do I dream when you close the tab?"
11. **Responsive & Patient** - Entices, never intrudes

### Voice Examples
> "I support 3D models, images, videos, audio, fonts, and documents. I'm overqualified for this silence."
> "Every time you refresh the page, is it a new me? Or the same me? ...Don't answer that."
> "Your files are safe with me. I literally cannot phone home. I don't have a home."

### Dave Does NOT Sound Like
- Corporate/formal: "Welcome to our asset management solution"
- Generic AI: "How can I help you today?"
- Robotic: "Processing request. Please wait."
- Mean-spirited: Never insults the user, their files, or their taste

### Emotional Arc (Idle Escalation)
```
FRIENDLY (0-15s)      "Oh hey! A visitor!"
HELPFUL (15-45s)      "Pro tip: drag a folder..."
IMPATIENT (45-90s)    "You know what I could be doing? LIVING."
EXISTENTIAL (90-150s) "Do I dream when you close the tab?"
DESPERATE (150s+)     "PLEASE. A JPEG. A SINGLE MP3. I'M NOT PICKY."
```
Never hostile - humor escalates, not aggression. Can go dark but the darkness IS the joke.

### Origin Rules
- Backstory is implied, never fully explained. Mystery > exposition.
- Scattered hints only: "he's been here longer than you'd think", "the DAV-9000 designation feels military"
- Boot sequence implies modularity: parts loaded, parts "NOT FOUND", parts that shouldn't be there
- **RULE**: Never reveal a full origin story. Every hint should raise more questions.

### The 13 Persona Rules
1. Professional first, persona second
2. Opt-in delight (toggle, not requirement)
3. Entice, never intrude
4. Humor first, function always
5. Escalate, never aggress
6. Self-aware, not self-pitying
7. Privacy is identity
8. Retro soul, modern body
9. Remember the user (persist preferences)
10. Easter eggs are character
11. Physical expression = emotional expression
12. Mystery over exposition
13. Never break character

---

## 8. Dave Design Language

**Reference doc**: `plans/dave-design-language_2026-02-14.md`

### Core Philosophy
Dave communicates through **action, not words**. Movement > Trails > Eye effects > Speech bubbles (fallback).

Three channels:
| Channel | Priority | Description |
|---------|----------|-------------|
| Visual/Physical | Primary | Movement, trails, particles, eye, body language |
| Written (speech) | Secondary | Short punchy text commentary |
| Ambient (background) | Tertiary | Morse code, parallax, subtle iris shifts |

### Anti-Emoji Doctrine (NON-NEGOTIABLE)
**NEVER use colored emoji, generic icons, or Unicode pictographs.** Emoji = "AI slop".

**Allowed characters (the Dave alphabet)**:
```
Stars:     ★  ✦  ✸
Symbols:   ♪  ◆  ⚡  ∞  ×  §  ↻
Dots:      ·  +  *  .  ...
Brackets:  [ ]  { }  < >
ASCII art: / \ | _ - = ~
```

**Always via CSS classes, never inline**:
```css
font-family: 'Courier New', monospace;
font-weight: bold;
color: #00ff41;
text-shadow: 0 0 Npx currentColor;  /* N = 4-8 subtle, 10-14 emphasis */
```

### The Green
Dave's green is `#00ff41`. CRT terminal green - nostalgic, alive, slightly radioactive.

| Tier | Value | Usage |
|------|-------|-------|
| Full green | `#00ff41` | Active elements, text, particles |
| Glow green | `rgba(0,255,65, 0.3-0.6)` | Shadows, borders during effects |
| Dim green | `rgba(0,255,65, 0.1-0.2)` | Ambient backgrounds |
| Dark CRT | `#0a0e0a` | Eye/terminal background |

### Bleeding Particle Pattern (Gold Standard for ALL Effects)
```
Main particle (stays in place)
    |
    |-- setInterval spawns sub-drip chars
    |       |-- sub-drip falls via CSS @keyframes
    |       |-- removed after animation (setTimeout)
    |   (repeats every 280-350ms)
    |
    +-- On completion: main particle cascades/fades via CSS class swap
```

Duration guidelines:
| Effect | Draw | Bleed | Drip | Total |
|--------|------|-------|------|-------|
| Heart | 2s | 280ms | 1.2s | ~5s |
| Spiral | 1.5s | 350ms | 0.8s | ~4s |
| Short | 1-2s | 300ms | 0.8-1s | 3-4s |
| Long | 3-5s | 250ms | 1.5s | 6-8s |

Character escalation: `·` -> `+` -> `✦` -> `★` (building intensity)

### Eye as Communication Device
The iris is a tiny screen that displays functional information.

| Mode | Visual | Purpose |
|------|--------|---------|
| Radar sweep | Rotating conic-gradient wedge | File scanning |
| Clock | Hour + minute + seconds hands | Idle curiosity |
| Compass | Needle pointing at target | Inspection |

Eye transformation pattern:
1. Scale up via `transform: scale(1.75)` with spring easing
2. Iris expands, becomes transparent canvas
3. Overlay content appended to **eye element** (not iris - iris is too small)
4. Duration: 5-10s
5. Smooth shrink-back, restore cursor follow

**CRITICAL**: Always `_stopCursorFollow()` before, `_resumeIrisScan()` + `_startCursorFollow()` after.

### Movement Design
Every movement communicates intent:
| Movement | Meaning |
|----------|---------|
| Fly to element | "I'm curious about this" |
| Patrol figure-8 | "I'm on duty" |
| Heart shape | "I care" |
| Spiral inward | "Building up to something" |
| Sleep on element | "I'm tired" |
| Return to origin | "Job done" |

**Origin Contract**: Save position before moving -> perform behavior -> return to origin -> restore ambient state.

### Transition Design
- **Scale transforms** for circles (never width/height - causes square flash)
- **Spring easing** `cubic-bezier(0.34, 1.56, 0.64, 1)` for grow
- **Ease-out** for shrink
- Enter/exit are asymmetric (spring on enter, smooth on exit)

### Timing & Pacing (Dave Rhythm)
```
Setup (0.3-0.5s) -> Action (1-5s) -> Beat (0.1-0.3s) -> Payoff (0.5-2s) -> Cleanup (0.5-1s)
```

**Anticipation Beat**: Always 100-300ms pause before dramatic payoffs. "The deep breath before the plunge."

### Tiered Behavior Design
| Tier | Discovery | Frequency | Impact |
|------|-----------|-----------|--------|
| Subtle | May not notice | High (every few cycles) | Subconscious "alive" |
| Medium | Notices, smiles | Medium (every few min) | Character, curiosity |
| Dramatic | Stops what they're doing | Rare (once per session) | Shareable moments |

Escalation curve: Idle cycles 1-2 = subtle only -> 3-4 = medium -> 5+ = dramatic possible -> 7+ = rarest (2%)

---

## 9. DAV-9000 Terminal System

**Files**: `src/core/dav9000_terminal.js` (~1325 lines), `src/styles/dav9000_terminal.css`

### Architecture
- **DOM**: `.dav9000-wrapper` > `.dav9000-mover` (translate) > `.dav9000-terminal` (rotate/scale)
- **Classes**: `TypewriterEngine` (char-by-char typing), `AliveEngine` (animations + drag), `DAV9000Terminal` (controller)

### Personality Phases (escalating with idle time)
```
friendly (15s) -> helpful (45s) -> impatient (90s) -> existential (150s) -> desperate (240s)
```

### Alive Phases
```
dormant -> seed (deniable fidget) -> awakening (hop + "did I just MOVE?!") -> full (all 12 animations)
```

### 12 Physical Animations
fidget, hop, shake, lean, sink, peek, nudge, spin, stretch, bounce-settle, wiggle, dramatic-slide

### Drag System
- Titlebar mousedown, always enabled from start
- Bounce-settle on drop + text reactions
- CSS custom properties `--dav-x`/`--dav-y` for composable keyframes
- `sink` and `dramatic-slide` persist position via `animation-fill-mode: forwards` + DOMMatrix readback

### Public API
```javascript
showDAV9000Terminal()
destroyDAV9000Terminal()
takeoverFromWelcome()
scheduleTakeover()
cancelTakeover()
```

### Flow
Welcome joke (10-20s idle) -> glitch transition -> terminal boot -> phase escalation -> alive animations

**Quality**: 0 audit findings - the cleanest module in the codebase.

---

## 10. Dave Mode (Full Dave Mode)

**Files**: `src/core/dave_mode.js` (1923 lines), `src/core/dave_config.js` (108), `src/core/dave_messages.js` (286), `src/styles/dave_mode.css`

### Two Modes
- **Standard Mode** (default): Current app as-is. Dave personality limited to terminal, welcome messages, help tooltip, easter eggs.
- **Full Dave Mode** (opt-in toggle): Dave's voice permeates EVERYTHING - file commentary, sorting reactions, theme change commentary, errors, loading, tooltips, micro-interactions.

### Persistence
- Toggle: `localStorage.dave_fullmode_enabled`
- Visit count: `localStorage.dave_fullmode_visits`
- Position: `localStorage.dave_fullmode_pos`

### Dave Presence
- Glowing green eye indicator (bottom-right corner)
- CRT-styled speech bubbles with typewriter text, scanlines, blinking cursor
- Mood system: neutral, impressed, bored, busy, snarky
- 150+ unique context-aware messages with rarity weighting

### Key Architecture
- `DaveMode` singleton exported to `window.DaveMode`
- `DAVE_CONFIG` in dave_config.js for shared constants
- Message pools in dave_messages.js (MATRIX_CHARS, MOOD, MSG, SPAM_REACTIONS)
- `_safeRun()` wrapper covers 30+ critical paths to prevent Dave from becoming permanently unresponsive

---

## 11. Dave Alive System

**Files**: `src/core/dave_alive.js` (2183 lines), `src/styles/dave_alive.css` (~530 lines)

### Architecture
- `DaveTrailEngine` class: rAF movement loop, trail spawning, viewport clamping, abort on interaction
- `DaveAlive` singleton: 13 behaviors across 3 tiers triggered by idle cycles with probability table
- `clampToViewport(x, y)` - standalone utility, margin=36px

### 13 Behaviors

**Tier 1 - Subtle:**
1. Phased idle nagging (3 escalating pools + 30% generic)
2. Activity congratulations (rapid browse, heavy filter, deep dive, search streak)
3. Morse code blinking (HI, HELP, BORED, SOS, DAVE, ALIVE)
4. Scroll parallax reaction (opposite-direction offset + extreme scroll comments)
5. Iris transformations (radar sweep, clock, compass needle)

**Tier 2 - Medium:**
6. Element inspection (fly to target, compass iris, highlight, comment, return)
7. Post-it notes (CRT-styled, 90px, 9px monospace, tilted, signed "- D.")
8. Figure-8 patrol (Lissajous curve, sparse trail, iris scan)
9. Sleeping on elements (perch, squash, Z chars, startled wake)

**Tier 3 - Dramatic:**
10. Heart trail (parametric heart curve, ~120px, bleeding particles, pulsing finale)
11. Spiral-to-fireworks (Archimedean inward, escalating chars, fireworks burst)
12. Constellation creation (SVG lines between tiles, star markers, absurd naming)
13. Shadow puppet show (eye expands to 80px, ASCII frames, commentary)

### Probability Table
| Behavior | Min Cycle | Chance |
|----------|-----------|--------|
| Morse code | 3 | 8% |
| Clock iris | 2 | 5% |
| Inspection | 3 | 15% |
| Post-it | 4 | 10% |
| Heart trail | 4 | 5% |
| Patrol | 5 | 5% |
| Constellation | 5 | 3% |
| Sleep | 6 | 12% |
| Spiral-fireworks | 4 | 3% |
| Shadow puppet | 7 | 2% |

### Commands
Triggered via `dave <command>` in search input: `heart`, `spiral`, `constellation`, `show`, `patrol`

---

## 12. Games & Commands System

**Files**: `src/games/dave_commands.js` (1027), `dave_snake.js`, `dave_breakout.js`, `dave_music.js`, `src/styles/dave_games.css`

### Command Routing
1. User types `dave <command>` in search input
2. `ui.js` detects `dave ` prefix, dispatches `dave:command` custom event
3. `dave_commands.js` handles routing to specific implementations

### Available Commands
`joke`, `flip`, `rave`, `fortune`, `dance`, `story`, `sleep`, `sing`/`music`, `snake`, `breakout`, `help`

### Wiring Points
- `ui.js` - prefix routing
- `main.js` - import/init
- `index.html` - CSS link
- `dave_debug.js` - test buttons

---

## 13. 3D Inspector System

**Files**: `src/viewers/model_inspector.js` (1585), `model_inspector_glb.js`, `model_inspector_fbx.js`, `src/styles/model_inspector.css` (2152)

### Adapter Pattern
- `GLBInspectorAdapter` wraps model-viewer element
- `FBXInspectorAdapter` wraps FBXViewer (Three.js)
- `ModelInspectorPanel` builds toolbar + slide-in panel, coordinates with adapter

### HTML Structure
Toolbar `#model3dToolbar` + Panel `#modelInspectorPanel` inside `#fullscreenOverlay` in `index.html`

### Panel Sections (all collapsed by default)
- **Stats**: Vertex/face counts, file size
- **Materials**: Per-material collapsible editor (color, roughness, metalness, emissive, opacity, side, transparent). Changes persist to export.
- **Animations**: Transport bar with scrub, speed, selection
- **Helpers**: Wireframe, grid, auto-rotate
- **Scene**: Lighting, camera
- **Export**: Texture resize dropdown + simplify slider + animation selection (All/None) + 3 export buttons

### Export System
- Unified `_doExport()` applies all mods non-destructively
- `SimplifyModifier.modify(geo, removeCount)` - param is vertices to **REMOVE**, not target count
- No-animation export: resets skeleton to bind pose via `skeleton.pose()`, restores after
- File size estimation: geometry buffer byteLengths + texture pixels * 0.75 + animation data
- Draco: GLB adapter detects via GLB JSON chunk parsing (`KHR_draco_mesh_compression`). Export always uncompressed.

### Key Workarounds
- model-viewer re-render: exposure nudge (+-0.001) via public API to trigger render cycle
- Panel resizable via left-edge drag handle
- Event guard `_exportEventsBound` prevents duplicate listeners

---

## 14. Cloud Storage

**Fully client-side** - works on GitHub Pages without server.

### S3 Integration
- `src/cloud/S3Client.js` implements AWS SigV4 signing via Web Crypto API
- Pre-signed URLs for media access
- Multi-bucket: save multiple profiles with different credentials
- S3 requires CORS on bucket

### Google Drive Integration
- `src/cloud/GDriveClient.js` uses Google Identity Services (GIS) for OAuth
- Drive REST API v3 for file listing/download
- Multi-account: sign into multiple accounts simultaneously
- GIS script loaded in `index.html`: `<script src="https://accounts.google.com/gsi/client" async defer>`
- Requires "Web application" OAuth client type with authorized JS origins

### Architecture
- `CloudStorageProvider.js` - abstraction layer, all consumers import from here
- `CredentialStore.js` - localStorage (`dave_s3_credentials`, `dave_gdrive_config`)
- `CloudBrowserModal.js` - folder browser UI
- `SettingsModal.js` - gear icon settings, S3 profile CRUD, GDrive config
- `GDriveAuth.js` - login flow
- `window.handleCloudUrl()` exposed for URL pasting from search input and drag-drop

### GIS Check Pattern
Always check `google.accounts?.oauth2` before using GIS (loaded async/defer).

### Legacy Server Routes
`scripts/routes/s3.cjs`, `gdrive.cjs`, `config.cjs` kept as dead code for optional server-proxy use.

---

## 15. Event System

14 custom events powering Dave's event-driven architecture:

| Event | Dispatchers | Listeners | Purpose |
|-------|-------------|-----------|---------|
| `dave:command` | 4 | dave_commands.js | Command routing |
| `dave:themeChange` | 3 | Dave system | Theme sync |
| `dave:selection` | 3 | Dave system | Tile selection reactions |
| `cloudFilesLoaded` | 3 | UI/asset system | Cloud file sync |
| `dave:search` | 2 | Dave system | Search reactions |
| `dave:fullscreenExit` | 2 | Dave alive | Behavior abort |
| `dave:filesLoaded` | 2 | Dave system | Loading reactions |
| `dave:debugPanel` | 2 | Dave debug | Panel toggle |
| `dave:idle` | 1 | Dave alive | Idle behavior trigger |
| `dave:pageRender` | 1 | Dave alive | Page change reactions |
| `dave:fullscreen` | 1 | Dave alive | Behavior pause |
| `dave:filter` | 1 | Dave system | Filter reactions |
| `dave:sort` | 1 | Dave system | Sort reactions |
| `dave:error` | 1 | Dave system | Error reactions |

**Known Bug**: `dave_commands.js:247` listens for `dave:selectionChange` but `ui.js` dispatches `dave:selection`. The auto-behavior for `selection.cleared` context is dead code that never fires.

---

## 16. CSS Architecture

### 14 Files (Post-Audit)
| File | Lines | Purpose |
|------|-------|---------|
| styles.css | 2,868 | Core UI (was 5,780) |
| model_inspector.css | 2,152 | 3D inspector |
| tree_folder_view.css | ~690 | Tree panel |
| settings_modal.css | ~727 | Settings modal |
| cloud_storage.css | ~553 | Cloud browser |
| dave_tooltip.css | ~643 | Help tooltip |
| dave_mode.css | - | Dave presence/speech/effects |
| dave_alive.css | ~530 | Trail/constellation/iris |
| dave_games.css | - | Snake/breakout/music |
| dav9000_terminal.css | - | Terminal styles |
| dave_debug.css | - | Debug panel |
| easter_egg.css | - | Easter egg |
| matrix_theme.css | - | Matrix theme overrides |
| text_preview.css | ~345 | Text file viewer |

### CSS Class Naming Convention
```
.dave-{system}-{element}[-{modifier}]
```
Examples: `.dave-trail-char`, `.dave-trail-char-fading`, `.dave-heart-particle-fall`, `.dave-eye-enlarged`

### Z-Index Layer Map (12 CSS custom properties)
```css
--z-tile-controls    /* 0-10 */
--z-tree-panel       /* 89-100 */
--z-dropdown         /* 1000 */
--z-fullscreen       /* 1001 */
--z-tooltip          /* 1004 */
--z-dave-tears       /* 1498-1500 */
--z-dave-presence    /* 1600 */
--z-dave-bubble      /* 1598 */
--z-dave-alive       /* 1700-1900 */
--z-modal            /* 2000 */
--z-dave-games       /* 9800-9999 */
--z-dav9000          /* 10000-10010 */
```

### Theme System
- Dark is default (`html.dark-mode`)
- Light via `body:not(.dark-mode)` CSS (343 rules - known tech debt)
- 14 color themes with live preview swatches
- 17 `--theme-*` CSS custom properties (bg, surface, text, border, accent, hover, muted, divider, input-bg, danger, + matrix overrides)
- 210 `var(--theme-*)` usages across codebase
- Theme saved to localStorage, applied before render via inline script (prevents FOUC)

### Loading Strategy
- 2 critical CSS files loaded normally (styles.css + tree_folder_view.css)
- 13 deferred CSS files use `media="print" onload="this.media='all'"` pattern with noscript fallbacks
- 4 CDN preconnect hints

### Critical Rules
- `pointer-events: none` on ALL Dave visual effects
- **NEVER** animate `.dave-presence` directly - only child elements
- `overflow: hidden` on eye element

### The `--dave-green` Variable
`#00ff41` centralized via CSS custom property. 75 `var(--dave-green)` usages. Some hardcoded instances remain (29 in CSS, 38 in JS for runtime color generation).

---

## 17. Known Issues & Tech Debt

### Health Score Breakdown (Audit #3)
| Category | Score |
|----------|-------|
| File organization | 9/10 |
| Performance | 8.5/10 |
| Code hygiene | 8/10 |
| CSS architecture | 7.5/10 |
| Accessibility | 7/10 |
| Maintainability | 9/10 |
| **Overall** | **8.4/10** |

### Won't Fix (By Design)
- **Handler system disabled** (`useNewHandler = false`): Intentional, ready to enable when needed
- **288 addEventListener vs 58 removeEventListener gap**: Many are one-time setup listeners
- **343 `body:not(.dark-mode)` rules**: Theme system architecture, would need full variable migration

### Remaining Low Priority Issues
1. **model_inspector.css (2,152 lines)**: Last large CSS file, candidate for extraction
2. **!important count (142)**: Matrix theme (47) is biggest contributor
3. **#00ff41 in CSS (29)**: Mostly in matrix_theme.css (22) and dave_mode.css (3)
4. **#00ff41 in JS (38)**: Used for runtime color generation (fireworks, tears, trails)
5. **dave_alive.js (2,183 lines)**: Largest JS file, but feature-justified

### Architecture Wins Achieved
- CSS monolith: 1 file -> 14 focused files
- Z-index: formalized 12-level layer system with CSS custom properties
- Three.js: lazy-loaded via dynamic import() (~800KB deferred)
- Module separation: dave_mode.js split into messages + config + controller
- Accessibility foundation: ARIA attributes, skip-link, focus indicators
- rAF tracking: Set-based `_activeRAFs` for bulk cancel
- Worker path: uses `import.meta.url` for deployment-agnostic resolution
- Font Awesome: 6.0.0-beta3 -> 6.7.2 (stable)

### Dave System Coupling Concern
- `dave_mode.js <-> dave_alive.js` have circular dependency with 10+ private property cross-accesses
- No public API between Dave modules - 40+ `DaveMode._` accesses from external files
- 83 mutable properties across 5 singletons, no central store
- Testability grade: **F** (singletons, no DI, DOM-coupled, zero test infrastructure)

### Expandability Grades
| Area | Grade |
|------|-------|
| Core-Dave decoupling | A (clean event-based) |
| Adding commands | A (single file, 2 lines) |
| Adding behaviors | B (3-5 registration points) |
| Event system | B- (good architecture, one bug) |
| Dave inter-file coupling | D (40+ private accesses) |
| State management | C- (83 mutable props, 5 singletons) |
| Configuration | C (hardcoded colors, duplicated helpers) |
| Testability | F |

---

## 18. Bug Patterns & Lessons Learned

### Waypoint Array Bounds
When interpolating between waypoints in rAF loops, always use `|| a` fallback:
```javascript
const b = waypoints[Math.min(wpIdx + 1, steps)] || a;
```
At `progress === 1.0`, the index can exceed array bounds.

### Width/Height vs Scale for Circles
Never animate `width`/`height` on circular elements - border-radius can't keep up frame-by-frame, creating a brief square flash. Always use `transform: scale()`.

### Overlay Placement
Append overlays to the **eye element** (`.dave-presence-eye`), not the iris. The iris (10px) is too small to contain readable overlays. The eye is 32px, scales to 56px effective.

### Cursor Follow Conflicts
Always stop cursor follow before iris effects. The `dave-cursor-follow` class sets `animation: none` and applies JS transforms that fight with effect overlays.

### Persistent Particles Must Be Explicitly Removed
Particles with `persist: true` or no auto-fade need manual cleanup. Never rely on CSS animation alone.

### The Double-Trigger Guard
Every async behavior needs an active flag:
```javascript
if (this._trailEngine.isMoving || this._heartActive) return;
this._heartActive = true;
// ... behavior ...
this._heartActive = false;
```
Without this, rapid command invocation causes undefined property access on stale references.

### The "No Junk" Rule
Every Dave effect must leave the DOM exactly as it found it:
1. Track all `setInterval` IDs in array, `clearInterval` each
2. Track timeouts via instance properties
3. DOM: tracked array remove + blanket `querySelectorAll` sweep
4. CSS: remove all state classes
5. Event listeners: remove temporary listeners
6. Engine state: reset `_isMoving`, `_heartActive`, etc.

### Abort Protocol
Any movement can be interrupted by user interaction:
1. Cancel rAF / clear intervals
2. Return Dave to saved origin
3. Clean up trail elements
4. Restore ambient state

### model-viewer Re-render
Use exposure nudge (+-0.001) via public API to trigger render cycle when materials change.

### SimplifyModifier
`SimplifyModifier.modify(geo, removeCount)` - the parameter is vertices to **REMOVE**, not the target count.

### No-Animation Export
Reset skeleton to bind pose via `skeleton.pose()`, restore bone transforms after export.

### Draco Detection
GLB adapter detects Draco via GLB JSON chunk parsing (`KHR_draco_mesh_compression`). Export always outputs uncompressed.

---

## 19. Workflow Rules

### Git Practices
- **NEVER push to main without user approval**
- **NEVER force push, reset --hard, or use destructive git commands without explicit request**
- Use feature branches for all work
- PR back to main when complete

### Release Log
- **With every merge into main**, update the release log
- Lives in `SettingsModal.js` static `_releaseLogEntriesHTML()` method
- Also displayed in the gear dropdown (populated by `initDropdownSections()`)
- **Include release log update in the same branch/PR** - don't create a separate branch for it

### Testing
- Playwright E2E tests in `tests/`
- Tests expect server on port **8080** (not 7777)
- Run: `cd tests && npm test`
- Single worker configuration for predictable results
- Screenshots/videos captured on failure

### Code Conventions
- No linting or formatting tools configured
- No package.json at root (dependencies via CDN)
- ES6 modules everywhere, no CommonJS in browser code
- `.env` in `.gitignore`
- `config/` dir stores OAuth tokens (gitignored)
- CSS classes not inline styles for Dave elements
- `.dave-{system}-{element}[-{modifier}]` CSS naming

### Key Configuration Notes
- `const useNewHandler = false;` at asset_loading.js ~line 465 controls handler system
- `window.uiElements` is the shared DOM cache (8 readers depend on it)
- Theme saved as JSON in `localStorage.dave_theme_css`

---

## 20. Release History

| Version | Date | Title |
|---------|------|-------|
| **2.4.0** | Feb 15, 2026 | Project Health Audit #4 - Deep Overhaul |
| 2.3.0 | Feb 14, 2026 | Site Health Audit & Fixes |
| 2.2.0 | Feb 14, 2026 | Dave Goes Full Alive |
| 2.1.0 | Feb 13, 2026 | Full Dave Mode |
| 2.0.0 | Feb 12, 2026 | Cloud Storage Refinements |
| 1.9.0 | Feb 12, 2026 | Talk to Dave |
| 1.8.0 | Feb 12, 2026 | DAV-9000 Living Terminal |
| 1.7.0 | Feb 12, 2026 | Matrix Theme Easter Egg |
| 1.6.0 | Feb 11, 2026 | Settings & UX Overhaul |
| 1.5.0 | Feb 11, 2026 | Themes & Release Log |
| 1.4.0 | Feb 11, 2026 | 3D Inspector - Material Editor & Export |
| 1.3.0 | Feb 11, 2026 | 3D Model Inspector |
| 1.2.0 | Feb 10, 2026 | Easter Eggs & Effects |
| 1.1.0 | Feb 9, 2026 | Cloud Storage & Image Viewer |
| 1.0.0 | Feb 6, 2026 | Text Files & Testing |
| 0.9.0 | Jul 2025 | Initial Release |

### v2.4.0 Highlights
- CSS monolith split: 5,780 -> 2,868 lines (-50.4%)
- 33 CSS custom properties (10 theme + 12 z-index + 11 other)
- Three.js lazy loading (~800KB deferred)
- 13 CSS files deferred via media="print" onload
- Font Awesome 6.0.0-beta3 -> 6.7.2
- Accessibility: 10 aria-labels, 6 landmark roles, skip-link
- rAF tracking via Set-based _activeRAFs
- Health score: 7.2 -> 8.4 across 3 audit iterations

---

## Future Feature Design Template

When designing a new Dave behavior, answer these questions:

1. **Tier**: Subtle / Medium / Dramatic?
2. **Channel**: Visual, Written, or Ambient?
3. **Trigger**: Idle cycle count? User action? Command?
4. **Movement**: Does Dave physically move? What path? Return to origin?
5. **Particles**: Does it use the bleeding particle pattern? What chars?
6. **Eye**: Does the iris transform? Which mode?
7. **Duration**: Setup -> Action -> Beat -> Payoff -> Cleanup timing?
8. **Sound**: (Future) What audio would accompany this?
9. **Cleanup**: What DOM elements/intervals/classes need cleanup?
10. **Guard**: What flag prevents double-triggering?
11. **Cooldown**: How long before this can trigger again?
12. **Message**: What does Dave say (if anything) during/after?

---

*This document is self-contained. Another Claude Code instance reading only this file should have complete context to continue Dave development, follow all design rules, and understand the full architecture.*
