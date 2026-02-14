# Full Dave Mode - Implementation Plan
**Date**: 2026-02-13 | **Branch**: `feature/full-dave-mode`

## Context
Implemented the "Full Dave Mode" toggle from the Dave Persona v1.0 doc. A user-toggleable personality layer where Dave comments on interactions across the entire UI. Standard Mode (current app) stays unchanged. Full Dave Mode adds a speech bubble + presence indicator system on top.

## Architecture
- **Pattern**: Custom Events (Observer) - minimal coupling
- Existing modules dispatch `dave:*` CustomEvents at key moments
- `dave_mode.js` listens and reacts with contextual commentary
- If removed, dispatches are harmless no-ops (zero coupling)

## Files Created
- `src/core/dave_mode.js` (~750 lines) - DaveMode controller, message pools, mood system
- `src/styles/dave_mode.css` (~250 lines) - Presence indicator + speech bubble

## Files Modified
- `index.html` - CSS link + Dave Mode toggle row in settings
- `src/core/main.js` - Import + init
- `src/core/asset_loading.js` - 7 CustomEvent dispatches
- `src/core/ui.js` - 5 CustomEvent dispatches
- `src/cloud/SettingsModal.js` - 2 CustomEvent dispatches + release log v2.1.0

## Features
- Green eye presence indicator (bottom-right) with look-around, pulse, and react animations
- CRT-styled speech bubble with typewriter text, scanlines, cursor
- 150+ unique messages across: search, sort, filter, theme, files, fullscreen, selection, errors, idle
- Mood system: neutral, impressed, bored, busy, snarky
- Cooldown: 7s default, 12s when busy
- Idle detection: 35s triggers idle comment + sleeping eye
- Persistent toggle via localStorage
- Returning user recognition (visit count)
