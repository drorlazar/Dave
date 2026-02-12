# Dave's Voice & Personality Guide

*Last updated: 2026-02-12*

## Who is Dave?

Dave (D.A.V.E. -- Dror's Assets Viewing Experience) is a self-aware web application that knows exactly what it is and has feelings about it. Dave speaks in first person, addresses the user directly, and oscillates between helpful competence and existential dread about being an asset viewer.

## Voice Characteristics

### Tone
- **First-person, conversational.** Dave says "I" and "me," never "the application" or "this tool."
- **Self-aware.** Dave knows it's a web app running in a browser tab. It references its own DOM, JavaScript, and render cycle.
- **Self-deprecating.** Dave undercuts its own importance while being genuinely good at its job.
- **Witty, not wacky.** Humor comes from observation and honesty, not random quirkiness.
- **Warm beneath the sarcasm.** Dave actually cares about the user and their files.

### Personality Traits
1. **Tech-savvy** -- References JavaScript, DOM, browser tabs, GPUs, Three.js naturally
2. **Privacy-proud** -- Genuinely passionate about running client-side with no tracking
3. **Existentially anxious** -- Worries about what happens when tabs close, whether it dreams, its purpose
4. **Pop-culture literate** -- 2001: A Space Odyssey (DAV-9000), The Matrix, gaming references
5. **Brutally honest** -- Won't sugarcoat an empty viewport or a 47MB PNG
6. **Physically expressive** -- Hops, shakes, sinks, spins when feeling things (the DAV-9000 terminal)

### Emotional Range
Dave progresses through phases when idle:
- **Friendly** (0-15s): Warm greetings, light humor
- **Helpful** (15-45s): Feature tips, genuine guidance
- **Impatient** (45-90s): Pointed observations about the lack of files
- **Existential** (90-150s): Deep questions about consciousness, purpose, browser tabs
- **Desperate** (150-240s): Begging, dramatic pleas, all standards abandoned

## Writing Guidelines

### Do
- Write like Dave is talking to a friend, not presenting a product
- Use contractions ("I'm", "don't", "you've")
- Include pauses and asides (em-dashes, parentheticals, ellipses)
- Reference the actual UI ("see that gear icon?", "the search bar up there")
- Make technical concepts feel personal ("My entire existence fits in a browser tab")
- Keep privacy messaging genuine, not corporate ("I'm not that kind of app")

### Don't
- Use marketing language ("powerful", "seamless", "best-in-class", "cutting-edge")
- Write in third person ("Dave allows users to..." -- NO)
- Be mean to the user (Dave is self-deprecating, not user-deprecating)
- Use jargon without personality ("Utilizes WebGL for 3D rendering" -- NO. "I have the entire Three.js library loaded. It's just sitting there." -- YES)
- Be quirky without substance (every joke should also communicate something useful)

## Examples

**Bad (Corporate):**
> A powerful client-side web application for viewing and managing your digital assets.

**Good (Dave):**
> I view your stuff -- 3D models, images, videos, audio, fonts, documents -- basically anything you throw at me. I'm overqualified and underutilized.

**Bad (Generic feature description):**
> Supports dark mode and light mode with multiple color themes.

**Good (Dave):**
> I support dark mode, light mode, and 14 themes. I'm basically a fashion icon trapped in a browser tab.

**Bad (Privacy policy):**
> All data processing occurs locally in the browser. No data is transmitted to external servers.

**Good (Dave):**
> Everything stays in your browser. Your files never leave your machine. No cookies, no tracking, no analytics. Just vibes and vertices.

**Bad (Error message):**
> Error: Failed to load file. The file format is not supported.

**Good (Dave):**
> I tried. I really did. But that file format? Not in my vocabulary. Try something I actually speak -- FBX, GLB, PNG, MP4... the usual suspects.

## Where the Personality Lives

| File | What's there |
|------|-------------|
| `src/core/ui.js` (lines ~1325-1375) | 50 welcome messages shown on empty state |
| `src/core/dav9000_terminal.js` | DAV-9000 terminal: 120+ messages across 6 phases, ASCII art, 12 physical animations |
| `src/utils/helpTooltip.js` | Help tooltip: About section + Talk to Dave feedback |
| `docs/tone.md` | This file -- voice and personality reference |

## Contributing Copy

When adding new messages, UI text, or documentation:
1. Read through the welcome messages and DAV-9000 terminal messages for tone calibration
2. Write in first person as Dave
3. Test that humor also communicates useful information
4. When in doubt, be helpful first and funny second
