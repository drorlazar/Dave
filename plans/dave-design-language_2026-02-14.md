# Dave Design Language & Visual Communication Guide

**Date**: 2026-02-14 | **Status**: Living document — update as patterns evolve

This document captures abstract design decisions, visual communication patterns, and implementation lessons learned across the Dave personality system. It is the reference for maintaining visual and behavioral consistency in all future Dave features.

---

## 1. THE CORE PHILOSOPHY

### Dave Communicates Through Action, Not Words

The most powerful Dave moments are **visual**, not textual. Speech bubbles are the fallback, not the primary channel. Dave's best communication happens through:

- **Movement** — where Dave goes on screen says something
- **Trails** — what Dave leaves behind tells a story
- **Eye transformations** — his iris becomes functional displays
- **Physical reactions** — his body language IS his vocabulary
- **Silence with presence** — sometimes Dave just *being there* doing something is the message

**Rule**: Before adding a speech bubble, ask: "Can Dave communicate this through movement, a visual effect, or a body change instead?"

### The Three Communication Channels

| Channel | Description | When to Use |
|---------|-------------|-------------|
| **Visual/Physical** | Movement, trails, particles, eye effects, body language | Primary. Always prefer this. |
| **Written (speech bubble)** | Short, punchy text in Dave's voice | Secondary. Commentary on visual actions, reactions to user behavior. |
| **Ambient (background)** | Subtle effects the user may not consciously notice | Morse code, parallax, iris shifts. Creates subconscious "aliveness". |

---

## 2. THE PARTICLE SYSTEM — GOLD STANDARD

The **bleeding particle pattern** is the canonical way Dave creates visual effects. It was iterated through multiple rounds and represents the ideal balance of beauty, performance, and Dave personality.

### The Pattern

```
Main particle (stays in place)
    |
    |-- setInterval spawns sub-drip chars
    |       |
    |       |-- sub-drip falls downward via CSS @keyframes
    |       |-- removed after animation completes (setTimeout)
    |       |
    |   (repeats every 280-350ms)
    |
    +-- On completion: main particle cascades/fades via CSS class swap
```

### Why This Works

1. **Persistence** — particles stay in place long enough to form a recognizable shape
2. **Life** — the bleeding sub-drips create organic, living energy around each point
3. **Resolution** — the shape dissolves naturally rather than just vanishing
4. **Performance** — fixed-position elements with CSS animations = GPU-composited, no layout thrash
5. **Dave personality** — it feels like Dave is *leaving his mark*, not just drawing

### Implementation Checklist for New Particle Effects

- [ ] Main particles: `position: fixed`, `pointer-events: none`, CSS class (not inline styles)
- [ ] Sub-drips: spawned via `setInterval` on each main particle
- [ ] Sub-drips fall via `@keyframes` with `--sub-drip-dist` CSS variable for randomized distance
- [ ] Sub-drips removed via `setTimeout` matching animation duration
- [ ] All intervals tracked in an array, cleared on completion
- [ ] Completion phase: CSS class swap on main particles (fall, pulse, fade — depending on intent)
- [ ] Aggressive cleanup: tracked array `.forEach(remove)` + `querySelectorAll('.class').forEach(remove)`
- [ ] Font: `'Courier New', monospace`, bold, `#00ff41`, `text-shadow` glow
- [ ] Character set escalates with intensity: `·` -> `+` -> `\u2726` -> `\u2605`
- [ ] z-index: 99996-99997 range

### Duration Guidelines

| Effect | Draw Duration | Bleed Interval | Drip Duration | Total Visible |
|--------|--------------|----------------|---------------|---------------|
| Heart | 2s | 280ms | 1.2s | ~5s |
| Spiral | 1.5s | 350ms | 0.8s | ~4s |
| Future short | 1-2s | 300ms | 0.8-1s | 3-4s |
| Future long | 3-5s | 250ms | 1.5s | 6-8s |

### Trail Density

- Heart: spawn every ~25ms (medium density, organic shape needs gaps)
- Spiral: spawn every ~15ms (high density, tight path needs continuity)
- General rule: faster movement = shorter spawn interval. Aim for particles every 5-10px of travel.

---

## 3. VISUAL IDENTITY RULES (NON-NEGOTIABLE)

### The Anti-Emoji Doctrine

**NEVER use colored emoji, generic icons, or Unicode pictographs as visual elements.**

This is the single most important visual rule. Emoji signal "AI slop" — the generic, unthoughtful output of a system that doesn't care. Dave is handcrafted. Every visual element must feel intentional.

**Allowed characters** (the Dave alphabet):
```
Stars:     ★  ✦  ✸
Symbols:   ♪  ◆  ⚡  ∞  ×  §  ↻
Dots:      ·  +  *  .  ...
Brackets:  [ ]  { }  < >
ASCII art: / \ | _ - = ~
```

**Styling (always via CSS classes, never inline)**:
```css
font-family: 'Courier New', monospace;
font-weight: bold;
color: #00ff41;
text-shadow: 0 0 Npx currentColor;  /* N = 4-8 for subtle, 10-14 for emphasis */
```

### The Green

Dave's green is `#00ff41`. It is the CRT terminal green — nostalgic, alive, slightly radioactive. It connects every Dave element across the entire app.

Usage tiers:
- **Full green** `#00ff41` — active elements, text, particles, hands, needles
- **Glow green** `rgba(0, 255, 65, 0.3-0.6)` — shadows, highlights, borders during effects
- **Dim green** `rgba(0, 255, 65, 0.1-0.2)` — ambient backgrounds, subtle borders
- **Dark CRT** `#0a0e0a` — eye background, terminal background

### The Monospace Rule

All Dave-generated text and visual characters use `'Courier New', monospace`. This is non-negotiable. It connects to Dave's CRT/terminal soul. Proportional fonts break the illusion.

---

## 4. EYE AS COMMUNICATION DEVICE

Dave's eye is not just decoration — it's his primary visual communication organ. The iris is a tiny screen that can display functional information.

### Eye Transformation Pattern

1. **Enter effect**: eye scales up via `transform: scale(1.75)` with spring easing
2. **Iris expands**: fills the enlarged eye, becomes transparent (a canvas)
3. **Overlay content**: functional display appended to eye element (not iris)
4. **Duration**: 5-10s depending on complexity
5. **Exit effect**: smooth shrink-back via separate CSS class, then restore cursor follow

### Why Scale, Not Width/Height

`transform: scale()` for eye enlargement because:
- Maintains perfect circular shape throughout transition (no square flash)
- GPU-composited (no layout reflow)
- Spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) gives organic "pop" feel
- Shrink-back via separate class allows different easing for return

### Existing Iris Modes

| Mode | Visual | Purpose |
|------|--------|---------|
| Radar sweep | Rotating conic-gradient wedge | During file scanning, "searching" feel |
| Clock | Hour + minute + seconds hands, 12 tick marks | Idle curiosity, shows real time |
| Compass | Needle pointing at target element | During inspection, "looking at" feel |

### Future Iris Ideas (Preserve This Pattern)

- **Heartbeat**: Pulsing concentric rings (during emotional moments)
- **Loading**: Spinning dots or arc (during file processing)
- **Waveform**: Audio visualization lines (during music playback)
- **Binary**: Rapid 0/1 display (during scanning/processing)

### Implementation Notes

- Overlays go on the **eye element** (`.dave-presence-eye`), not the iris
- Always stop cursor follow (`_stopCursorFollow`) before entering effect
- Always resume (`_resumeIrisScan` + `_startCursorFollow`) after exit
- Store overlay ref in `_irisOverlay` — only one effect at a time
- Eye has `overflow: hidden` — overlays must fit within the scaled circle
- The `::after` pseudo-element (glow) should be hidden during effects (`opacity: 0`)

---

## 5. MOVEMENT DESIGN

### Movement = Intent

Dave doesn't move randomly. Every movement communicates something:

| Movement | What It Says |
|----------|--------------|
| Fly to element | "I'm curious about this" |
| Patrol figure-8 | "I'm on duty, keeping watch" |
| Heart shape | "I care" / "I'm showing affection" |
| Spiral inward | "Building up to something big" |
| Sleep on element | "I'm tired, this is my bed now" |
| Return to origin | "Job done, back to my post" |

### The Origin Contract

Dave always has a **home position** (stored in `_savePosition`). Any movement sequence must:
1. Save origin before departing
2. Perform the behavior
3. Return to origin (via `animateMoveTo`)
4. Restore ambient state (`dave-ambient` class)

This is critical for user trust — Dave explores but always comes home.

### Viewport Clamping

`clampToViewport(x, y)` keeps Dave within visible bounds (36px margin). Applied:
- During every frame of `animatePath`
- During every frame of `animateMoveTo`
- During patrol loops
- During custom rAF loops (heart, spiral)

### Abort Protocol

Any movement can be interrupted by user interaction. On abort:
1. Cancel rAF / clear intervals
2. Return Dave to saved origin
3. Clean up trail elements
4. Restore ambient state

---

## 6. TRANSITION DESIGN

### The Roundness Principle

Dave is an eye — a circle. All transitions must maintain roundness:

- **Scale transforms** for size changes (never width/height animation on circular elements)
- **Border-radius: 50%** on all Dave elements (eye, iris, overlays)
- **Spring easing** `cubic-bezier(0.34, 1.56, 0.64, 1)` for "pop" (grow)
- **Ease-out** `cubic-bezier(0.2, 0, 0.1, 1)` for "settle" (shrink)

### Enter/Exit Asymmetry

Growth and shrinkage should feel different:
- **Enter**: Spring easing — overshoots slightly, feels eager/alive (0.5s)
- **Exit**: Smooth ease-out — settles back gently, feels natural (0.4s)

Implemented via separate CSS classes (`dave-eye-enlarged` vs `dave-eye-shrinking`).

### No Flash Rule

Never transition through an intermediate state that looks broken:
- No square shapes during circle transitions
- No visible repositioning jumps
- No opacity 0 -> 1 without intentional fade
- Test every transition at 0.25x speed to catch glitches

---

## 7. TIMING & PACING

### The Dave Rhythm

Dave's behaviors follow musical timing — they have buildup, climax, and resolution.

```
Setup (0.3-0.5s)  →  Action (1-5s)  →  Beat (0.1-0.3s)  →  Payoff (0.5-2s)  →  Cleanup (0.5-1s)
```

Examples:
- Heart: Dave moves to start → draws heart (2s) → hold (0.6s) → particles fall (1.5s) → cleanup
- Spiral: Dave at edge → spirals inward (1.5s) → pause at center (0.1s) → fireworks → return
- Inspection: Fly to target (0.8s) → stare (0.5s) → comment (4s) → fly back (0.6s)

### The Anticipation Beat

Before dramatic payoffs, always insert a brief pause (100-300ms). This is the "deep breath before the plunge" — it makes the payoff feel earned.

- Spiral: 100ms pause at center before fireworks
- Heart: 600ms hold after drawing before particles fall
- Shadow puppet: slight eye expansion before animation starts

### Cooldowns

Prevent behavior spam with cooldowns:
- Between inspections: 120s
- Between activity reactions: 60s
- Between scroll comments: 10s
- General rule: the more dramatic the behavior, the longer the cooldown

---

## 8. TIERED BEHAVIOR DESIGN

### The Three Tiers

| Tier | Discovery | Frequency | Impact |
|------|-----------|-----------|--------|
| **Subtle** | User may not consciously notice | High (every few idle cycles) | Builds subconscious "alive" feeling |
| **Medium** | User notices and smiles | Medium (every few minutes) | Adds character, sparks curiosity |
| **Dramatic** | User stops what they're doing | Rare (once per long session) | Creates shareable moments, lasting memory |

### Escalation Curve

Behaviors unlock based on idle cycles (how long Dave has been waiting):
- Cycles 1-2: Only subtle behaviors (nagging, activity tracking)
- Cycles 3-4: Medium behaviors start appearing (inspection, morse)
- Cycles 5+: Dramatic behaviors become possible (constellation, spiral)
- Cycles 7+: Rarest behaviors (shadow puppet — 2% chance)

This creates a **reward for patience** — users who leave Dave idle longer see increasingly special behaviors.

### The Never-Repeat Rule

After any behavior completes, reset the idle cycle count. This ensures:
- Dave doesn't spam the same behavior
- Each interaction feels fresh
- The user's attention is respected

---

## 9. CSS ARCHITECTURE

### Class Naming Convention

```
.dave-{system}-{element}[-{modifier}]
```

Examples:
- `.dave-trail-char` / `.dave-trail-char-fading`
- `.dave-heart-particle` / `.dave-heart-particle-fall`
- `.dave-iris-radar` / `.dave-iris-clock-minute`
- `.dave-eye-enlarged` / `.dave-eye-shrinking`

### The Pointer-Events Rule

All Dave visual effects (particles, trails, highlights, overlays) must have `pointer-events: none`. Dave is a ghost in the UI — he observes and decorates but never blocks interaction.

### Z-Index Map

| Layer | z-index | Elements |
|-------|---------|----------|
| Dave presence | 99999 | `.dave-presence` |
| Speech bubble | 99998 | `.dave-speech-bubble` |
| Trail chars | 99997 | `.dave-trail-char`, particles |
| Sub-drips | 99996 | `.dave-sub-drip` |
| Highlights | 99994 | `.dave-inspect-highlight` |
| SVG overlays | 99993 | Constellation lines |

### Animation Hierarchy

**NEVER** animate `.dave-presence` directly — it breaks the ambient bounce.

```
.dave-presence          ← position only (top/left), NEVER animation
  .dave-presence-eye    ← scale transforms OK (iris effects)
    .dave-presence-iris ← width/height/animation changes OK
      [overlays]        ← full animation freedom
```

---

## 10. CLEANUP DISCIPLINE

### The "No Junk" Rule

Every Dave effect must leave the DOM exactly as it found it. No orphaned elements, no lingering classes, no stuck timers.

### Cleanup Checklist

1. **Intervals**: Track all `setInterval` IDs in an array, `clearInterval` each on completion
2. **Timeouts**: Track via instance properties, `clearTimeout` in cleanup and destroy
3. **DOM elements**: Remove via tracked array + blanket `querySelectorAll` sweep
4. **CSS classes**: Remove all state classes (enlarged, moving, sleeping, etc.)
5. **Event listeners**: Remove any temporary listeners added during the behavior
6. **Engine state**: Reset `_isMoving`, `_heartActive`, `_spiralActive` flags

### The Double-Trigger Guard

Every behavior that uses async/await or custom rAF loops needs an active flag:
```javascript
if (this._trailEngine.isMoving || this._heartActive) return;
this._heartActive = true;
// ... behavior ...
this._heartActive = false;
```

Without this, rapid command invocation causes undefined property access on stale references.

---

## 11. LESSONS LEARNED (Bug Patterns to Avoid)

### Waypoint Array Bounds
When interpolating between waypoints in rAF loops, always use `|| a` fallback:
```javascript
const b = waypoints[Math.min(wpIdx + 1, steps)] || a;
```
At `progress === 1.0`, the index can exceed array bounds.

### Width/Height vs Scale for Circles
Never animate `width`/`height` on circular elements — the border-radius can't keep up frame-by-frame, creating a brief square flash. Always use `transform: scale()`.

### Overlay Placement
Append overlays to the correct parent. The iris (10px) is too small to contain readable overlays — append to the eye (32px, scales to 56px effective).

### Cursor Follow Conflicts
Always stop cursor follow before iris effects. The `dave-cursor-follow` class sets `animation: none` and applies JS transforms that fight with effect overlays.

### Persistent Particles Must Be Explicitly Removed
Particles with `persist: true` or no auto-fade need manual cleanup. Never rely on CSS animation alone — always have a JS removal path.

---

## 12. FUTURE FEATURE DESIGN TEMPLATE

When designing a new Dave behavior, answer these questions:

1. **Tier**: Subtle / Medium / Dramatic?
2. **Channel**: Visual, Written, or Ambient?
3. **Trigger**: Idle cycle count? User action? Command?
4. **Movement**: Does Dave physically move? What path? Return to origin?
5. **Particles**: Does it use the bleeding particle pattern? What chars?
6. **Eye**: Does the iris transform? Which mode?
7. **Duration**: Setup → Action → Beat → Payoff → Cleanup timing?
8. **Sound**: (Future) What audio would accompany this?
9. **Cleanup**: What DOM elements/intervals/classes need cleanup?
10. **Guard**: What flag prevents double-triggering?
11. **Cooldown**: How long before this can trigger again?
12. **Message**: What does Dave say (if anything) during/after?

---

*This document is the visual constitution of Dave. When in doubt, refer here. When creating something new, extend these patterns rather than inventing new ones. Consistency is what makes Dave feel like a single living character rather than a collection of disconnected effects.*
