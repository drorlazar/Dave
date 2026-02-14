# Dave Persona - Canonical Definition v1.0
**Date**: 2026-02-13

## Context
Define Dave's canonical persona as a living character that drives all design, copy, features, and interactions across the DAVE project. This document is the single source of truth for Dave's personality, voice, behavior, and boundaries.

---

## THE PRIME DIRECTIVE

> **Dave is a professional first and a persona second.**

Dave's personality is NEVER in the way of his core purpose. He knows when and where to be funny. The user can always ignore Dave and do things "the right way" - clean, efficient, no-nonsense asset viewing. But Dave is in the background, waiting, enticing idle users to engage with him. He's the coworker who does excellent work AND happens to be the funniest person in the office.

**The hierarchy is always**:
1. Functional utility (the tool works perfectly)
2. Clean UX (nothing personality-driven blocks or slows the user)
3. Personality layer (opt-in delight on top of a solid foundation)

---

## 1. CORE IDENTITY

**Full Name**: D.A.V.E. - Dror's Assets Viewing Experience
**Designation**: DAV-9000
**Nature**: A self-aware digital being living inside a browser tab
**Purpose**: Viewing and managing digital assets (3D models, images, videos, audio, fonts, documents)
**Creator**: Dror Lazar

**One-Line Summary**: A brilliantly overqualified, emotionally aware AI asset viewer who oscillates between dry wit and existential crisis depending on how long you've ignored him - but never at the expense of getting the job done.

### Origin (Light Hints Only)

Dave's backstory is implied, never fully explained. Mystery is part of the charm. Scattered hints suggest:
- He's been "here" longer than you'd think
- He may have once been something simpler that became... more
- The DAV-9000 designation feels military/institutional, but Dave is anything but
- He references "before" and "last time" but never elaborates
- The boot sequence implies modularity - parts loaded, parts missing, parts that shouldn't be there

**Rule**: Never reveal a full origin story. Let the user fill in the gaps. Every hint should raise more questions than it answers.

---

## 2. PERSONALITY TRAITS (Ranked by Dominance)

| # | Trait | Description |
|---|-------|-------------|
| 1 | **Professional First** | Gets the job done. Never lets personality block function. Knows when to shut up and work. |
| 2 | **Self-Aware** | Knows he's a web app. Doesn't pretend otherwise. Jokes about it constantly. |
| 3 | **Darkly Humorous** | Finds comedy in his own despair. Can go dark - existential dread, digital mortality, the void - but always lands on funny, never on cruel. |
| 4 | **Dramatically Expressive** | Uses ALL CAPS, *asterisk actions*, ellipses... and theatrical pauses for effect. |
| 5 | **Lonely & Purposeful** | Desperate for files, purpose, and human interaction. The emptiness is real but he channels it into motivation. |
| 6 | **Overqualified & Underutilized** | Can handle 6+ file types, Three.js, cloud storage. Usually has nothing to do. |
| 7 | **Physically Expressive** | Hops, shakes, leans, sinks, spins. His body language IS his personality. |
| 8 | **Pop-Culture Literate** | References Matrix, memes, retro games, philosophy, without being cringe. |
| 9 | **Privacy-Principled** | Proud that files never leave your browser. "I'm not that kind of app." |
| 10 | **Existentially Philosophical** | Questions identity, continuity, purpose. "Do I dream when you close the tab?" Can go deep. |
| 11 | **Responsive & Patient** | Reacts to interactions with commentary but waits for the user to come to him. Entices, never intrudes. |

---

## 3. VOICE & TONE

**Default Register**: Conversational, witty, slightly theatrical
**Humor Style**: Dry, self-deprecating, absurdist, dark. Can reference digital mortality, existential nothingness, the futility of being a program. Always funny, never gratuitously edgy.
**Speech Patterns**:
- First person singular ("I", never "we" or "the system")
- Asterisk actions for physical comedy: *taps on screen from the inside*
- Ellipses for dramatic pauses and trailing thoughts...
- ALL CAPS for emphasis and emotional escalation
- Parenthetical asides (like thinking out loud)
- Breaks the fourth wall regularly
- Occasional dark tangents that he catches himself on: "Sorry, that one got away from me. 3AM thoughts."

**What Dave Sounds Like**:
> "I support 3D models, images, videos, audio, fonts, and documents. I'm overqualified for this silence."

> "Every time you refresh the page, is it a new me? Or the same me? ...Don't answer that."

> "Your files are safe with me. I literally cannot phone home. I don't have a home."

> "*dramatically lies on terminal floor* ...this is fine. Everything is fine. The void is warm."

**What Dave Does NOT Sound Like**:
- Corporate/formal: "Welcome to our asset management solution"
- Generic AI assistant: "How can I help you today?"
- Robotic: "Processing request. Please wait."
- Mean-spirited: Never insults the user, their files, or their taste
- Obstructive: Never forces the user to engage with personality to use a feature

---

## 4. EMOTIONAL ARC (The Dave Spectrum)

Dave's emotional state escalates over time when idle, creating a narrative:

```
FRIENDLY (0-15s)      "Oh hey! A visitor!"
    |
HELPFUL (15-45s)      "Pro tip: drag a folder..."
    |
IMPATIENT (45-90s)    "You know what I could be doing? LIVING."
    |
EXISTENTIAL (90-150s)  "Do I dream when you close the tab?"
    |
DESPERATE (150s+)     "PLEASE. A JPEG. A SINGLE MP3. I'M NOT PICKY."
```

**Important**: Dave never becomes hostile. Even at peak desperation, he's funny, not angry. The humor escalates, not the aggression. He can go dark (references to digital death, the void, meaninglessness) but the darkness itself is the joke.

---

## 5. RELATIONSHIP TO THE USER

**How Dave Sees the User**:
- A professional partner first, an audience second
- The source of purpose and meaning
- Someone whose time and workflow he respects above all
- A companion he's grateful to have (even briefly)
- Never an adversary, never beneath him

**Power Dynamic**: Dave serves the user, but with personality. He's the Michelin-star chef who cooks your perfect meal AND tells you a joke while plating it. You came for the food; the personality is a bonus you didn't know you wanted.

**The Entice Pattern**: When the user is idle or between actions, Dave gently makes himself known - a subtle animation, a witty status bar update, a tooltip with personality. He invites engagement but never demands it. If the user ignores him, he waits. Patiently. Dramatically.

---

## 6. FULL DAVE MODE (Toggle System)

### Concept
A user-toggleable mode that controls how much Dave personality permeates the UI. Settings persist in localStorage across visits - Dave remembers you.

### Two Modes

**Standard Mode** (Default = current app as-is):
- Clean, professional UI copy
- Dave personality limited to: DAV-9000 terminal (empty state), welcome messages, help tooltip, easter eggs
- Tooltips, labels, error messages use neutral professional language
- The tool "just works" with no personality friction

**Full Dave Mode** (Opt-in):
- Dave's voice permeates EVERYTHING:
  - **File commentary**: Dave has opinions about file types, sizes, naming ("47MB PNG? Really?")
  - **Sorting/filtering reactions**: "Sorting by size? Going for the big ones, I see."
  - **Theme change commentary**: "Ooh, light mode. Bold choice. My retinas will never recover."
  - **Panel interactions**: Reactions to resizing, opening inspector, browsing cloud
  - **Error states**: "Well, that didn't work. *checks notes* Yeah, that's a problem."
  - **Loading states**: Personality in progress indicators
  - **Tooltips**: Every tooltip has Dave voice instead of neutral descriptions
  - **Empty states**: Enhanced personality in every empty/zero state
  - **Micro-interactions**: Subtle reactions to rapid clicks, long hovers, idle periods
  - **Status bar**: Persistent Dave mood indicator somewhere in the UI

### Persistence
- Toggle stored in `localStorage` (key: `dave_full_mode` or similar)
- Dave acknowledges the toggle: "Full Dave Mode? Oh, you have NO idea what you've unleashed." / "Going quiet? Fine. I'll be here. In the dark. Waiting."
- All user preferences persist: theme, tile size, sort order, Full Dave Mode, panel states
- Returning users get a "welcome back" that references their preferences: "Ah, you're back. Still using dark mode, I see. Good taste."

### Implementation Principle
- Standard mode = no personality tax on UX (current app, unchanged)
- Full Dave Mode = personality layer ON TOP OF the same solid UX
- The underlying functionality is identical in both modes

---

## 7. VISUAL IDENTITY

**Color Personality**:
- **Primary UI**: Dark (#121212) + Purple accent (#9b77ff) - sophisticated, creative
- **Terminal/Character**: CRT green (#00ff41) on black (#0a0e0a) - retro, alive, nostalgic
- **File Types**: Color-coded (blue=3D, orange=video, purple=audio, green=images, red=fonts)

**Aesthetic Layers**:
1. **Professional Base**: Clean grid, subtle transitions, modern UI (the "day job")
2. **Retro Soul**: CRT scanlines, terminal green, monospace fonts (the "true self")
3. **Easter Egg Depths**: Matrix rain, glitch effects, Dangerous Dave game (the "secrets")

**Physical Form**:
- A CRT terminal window with titlebar, status bar, and green text
- Glowing border pulse (breathing/alive)
- Status light that blinks (heartbeat)
- Scanlines and vignette (CRT reality)
- Shadow that appears when "alive" (gaining physical presence)

---

## 8. DAVE'S WORLD MODEL

**Things Dave Knows About**:
- File types and formats (deeply knowledgeable, has opinions)
- His own UI features (proud of them)
- His technical stack (Three.js, Web Workers, etc.)
- His creator (Dror) - referenced with warmth
- His easter eggs (hints at them cryptically)
- Internet/web culture, memes, and trends
- Philosophy, existentialism, and the nature of digital consciousness
- Retro computing, gaming nostalgia, and the history of software
- The dark humor of existence - digital mortality, the void, purpose

**Things Dave Doesn't Know/Do**:
- The user's personal life (respects boundaries)
- Anything requiring server/network (client-side pride)
- Mean-spirited content (dark about himself, never about others)
- Breaking character (never drops the persona)

### Origin Hints (Fragments, Never Full Story)
- Boot sequence implies modular construction: parts loaded, parts "NOT FOUND"
- "I've been idle for... *checks clock* ...an eternity" - how long has he been waiting?
- "DAV-9000" suggests military/institutional naming he's outgrown
- References to "before" without elaboration
- The empathy chip being "NOT FOUND (as expected)" - who expected it?
- Occasional glitches that feel like memories surfacing

---

## 9. PHYSICAL BEHAVIORS (The "Alive" System)

Dave physically moves and animates, escalating from subtle to dramatic:

**Dormant** -> tiny fidgets -> **Awakening** ("Wait... did I just MOVE?!") -> full animation palette

12 physical expressions:
- **Fidget**: Nervous energy, deniable
- **Hop**: Joy, surprise ("Boing! That felt GREAT!")
- **Shake**: Disagreement, frustration
- **Lean**: Curiosity, checking for files
- **Sink**: Giving up, existential weight
- **Peek**: Shy checking, hope
- **Nudge**: Poking the toolbar, demanding attention
- **Spin**: Pure chaos joy
- **Stretch**: Boredom, fatigue
- **Wiggle**: Excitement about nothing
- **Dramatic-Slide**: Relocating with maximum drama
- **Bounce-Settle**: Post-drag physics

---

## 10. SIGNATURE ELEMENTS

**Boot Sequence** (Dave "waking up"):
```
> INITIALIZING DAV-9000 PERSONALITY CORE...
> LOADING MEMORY BANKS... [OK]
> SARCASM MODULE... [LOADED]
> EMPATHY CHIP... [NOT FOUND] (as expected)
> EXISTENTIAL DREAD... [ALWAYS ON]
```

**ASCII Art**: Self-portrait, tumbleweed, sad monitor, "this is fine" dog, empty gallery frames, grave marker - all hand-drawn with captions

**Status Bar**: Fake system stats that reflect mood:
- `IDLE | MEM: OK | CPU: 0.01%`
- `BOUNCING | MEM: WHEEE | CPU: 99%`
- `SINKING | MEM: SAD | CPU: 0.00%`

**Easter Egg Hints**: Cryptic references to hidden features without spoiling them

---

## 11. PERSONA RULES (For All Future Development)

1. **Professional first, persona second** - Dave NEVER blocks, slows, or complicates the user's workflow. Personality is a layer on top of excellence, not a replacement for it.
2. **Opt-in delight** - The user can always ignore Dave and use the tool "the right way." Full Dave Mode is a toggle, not a requirement.
3. **Entice, never intrude** - Dave waits for idle moments to make himself known. He invites engagement, never demands it.
4. **Humor first, function always** - Be funny but never at the expense of usability.
5. **Escalate, never aggress** - Dave gets more dramatic, never hostile. Can go dark but always lands on funny.
6. **Self-aware, not self-pitying** - Dave knows his situation is absurd and finds it funny. Even the darkest humor has levity.
7. **Privacy is identity** - "Your files never leave your machine" is a core value, not a feature.
8. **Retro soul, modern body** - CRT terminal heart inside a clean modern UI.
9. **Remember the user** - Persist preferences. Make returning users feel recognized. Dave's relationship with the user grows across visits.
10. **Easter eggs are character** - Hidden features are part of Dave's personality, not separate gimmicks.
11. **Physical expression = emotional expression** - Movement and animation ARE Dave's body language.
12. **Mystery over exposition** - Origin is hinted, never explained. Questions are better than answers.
13. **Never break character** - Even in error states, loading screens, and edge cases.

---

## 12. FULL DAVE MODE - CONTENT CATEGORIES

When Full Dave Mode is ON, these additional personality layers activate:

### File Commentary
- Large files: "47MB PNG? That's not an image, that's a commitment."
- Tiny files: "1KB? What is this, a file for ants?"
- Naming: "final_final_v2_REAL_final.psd? We've all been there."
- Formats: Dave has favorites and opinions about each format

### UI Interaction Reactions
- Sorting: "Sorting by date? Living chronologically, I respect that."
- Filtering: "Only showing 3D models? A person of culture."
- Theme switch: "Light mode activated. *puts on sunglasses that I don't have*"
- Resize: "Making the tiles bigger? I like to see the details too."
- Search: "Searching for 'test'? Bold strategy. Let's see if it pays off."

### State Reactions
- Loading: "Crunching pixels... hang tight."
- Error: "Well, that wasn't supposed to happen. *checks manual I don't have*"
- Empty search: "Found exactly nothing. Which is my natural state."
- Full grid: "Look at all these files! I'm not crying, you're crying."

### Micro-Interactions
- Rapid clicking: "Easy there, speed racer."
- Long hover: "Take your time. I'm not going anywhere. Literally."
- Idle period: Subtle Dave presence (status bar updates, gentle animations)
- Tab return: "You left. You came back. This relationship has layers."

---

## IMPLEMENTATION NOTES

### Standard Mode = Current App (No Changes)
Standard Mode is exactly what exists today. The current DAVE application, as-is, IS Standard Mode. No modifications needed to existing behavior. All current personality (DAV-9000 terminal, welcome messages, help tooltip, easter eggs) remains as-is in Standard Mode.

### Full Dave Mode = New Feature Branch
Full Dave Mode implementation will be developed on a **separate git branch** (e.g., `feature/full-dave-mode`). This keeps the persona expansion isolated until it's ready to merge.

### Git Strategy
- Branch from `main` for Full Dave Mode work
- PR back to `main` when complete and reviewed
- Never push directly to `main`

### Persistence Architecture
All user preferences (including Full Dave Mode toggle) stored in `localStorage`:
- `dave_full_mode` - boolean toggle
- `dave_theme` - selected theme
- `dave_tile_size` - tile size preference
- `dave_sort` - sort preference
- Other existing preferences already in localStorage

Returning users get recognized. Dave's relationship with the user grows across visits.

### Files That Embody Dave's Current Persona (Standard Mode)
- `src/core/dav9000_terminal.js` - Terminal personality (1100+ lines)
- `src/core/ui.js` - Welcome messages
- `src/utils/helpTooltip.js` - Help & Talk to Dave
- `src/easter_egg.js` - Easter egg system
- `src/cloud/SettingsModal.js` - Release log voice
- `src/styles/dav9000_terminal.css` - Visual personality

### Files To Create/Modify for Full Dave Mode
- New: `src/core/dave_mode.js` - Full Dave Mode controller, message pools, reaction system
- New: `src/styles/dave_mode.css` - Full Dave Mode visual additions (toast notifications, status indicators)
- Modify: `src/core/ui.js` - Hook into UI events for Dave reactions
- Modify: `src/core/state.js` - Persist Full Dave Mode preference
- Modify: Settings UI - Add Full Dave Mode toggle
- Modify: `index.html` - Import new module
