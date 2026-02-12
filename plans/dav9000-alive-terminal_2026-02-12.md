# DAV-9000 Alive Terminal - Floating, Draggable, Physically Animated

**Date:** 2026-02-12
**Branch:** `DAV-9000` (continuing)

---

## Context

The DAV-9000 terminal currently has three reveals: (1) welcome joke, (2) glitch-transition to terminal with typing personality, (3) escalating phases of text. This plan adds a **fourth dimension**: the terminal physically comes alive. It moves, bounces, tilts, peeks off-screen, and can be dragged by the user — delivering a "wait, WHAT?" moment that no one expects from a terminal on a website.

The key insight: the physical comedy is **gradually revealed** just like the text personality was. First a barely-perceptible wobble (deniable), then a clear hop with a shocked reaction ("Wait... did I just MOVE?"), then full physical comedy that escalates with the text phases.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/core/dav9000_terminal.js` | Add `.dav9000-mover` DOM layer, AliveEngine class, drag system, new message pools, integrate into rotation |
| `src/styles/dav9000_terminal.css` | 12 animation keyframes, mover styles, drag cursors, ground shadow, secondary effects |

---

## DOM Architecture Change

Add a mover layer between wrapper and terminal:

```
.dav9000-wrapper          (grid flow - no transforms)
  .dav9000-mover          (NEW - transform: translate(x,y) for position)
    .dav9000-terminal      (transform: rotate() scaleX() scaleY() for shape)
```

## Three-Phase Movement Reveal

| Phase | When | What Happens | Drag? |
|-------|------|-------------|-------|
| **Seed** | helpful (45-90s) | ONE barely-perceptible fidget. No text. Deniable. | No |
| **Awakening** | impatient (~90s) | Terminal HOPS. Types "Wait... did I just MOVE?!" Drag enabled. | Yes |
| **Full** | existential+ (150s+) | Full physical comedy. All 12 animations. | Yes |

## 12 Animation Catalog

| # | Animation | Duration | Key Behavior |
|---|-----------|----------|-------------|
| 1 | fidget | 0.6s | Tiny rotate wobble (deniable) |
| 2 | hop | 0.7s | Squash-launch-stretch-land-bounce cycle |
| 3 | shake | 0.6s | Head-shake "no" rotation |
| 4 | lean | 1.8s | Tilt toward direction and back |
| 5 | sink | 2.5s | Sad drift downward (persists position) |
| 6 | peek | 3.0s | Slide off-screen, peek back, return |
| 7 | nudge | 2.0s | Push up toward toolbar |
| 8 | spin | 0.8s | Full 360 rotation (rare) |
| 9 | stretch | 0.8s | Stretch tall then settle |
| 10 | bounce-settle | 0.6s | Landing squash after drag drop |
| 11 | wiggle | 0.7s | Excited side-to-side |
| 12 | dramatic-slide | 3.0s | Slow slide to random offset (persists) |

## Phase Probability

| Phase | Anim Chance | Pool |
|-------|------------|------|
| friendly | 0% | - |
| helpful | 5% | fidget |
| impatient | 30% | hop, shake, lean, wiggle |
| existential | 40% | sink, dramatic-slide, lean, peek, shake, stretch |
| desperate | 50% | ALL |
