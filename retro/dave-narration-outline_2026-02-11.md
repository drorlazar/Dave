# Dave Video Explainer - Narration Script & Scene Breakdown
## "Building Dave: Design Decisions Behind an Asset Viewer"
### February 11, 2026

---

## Video Overview

**Format**: Screen recording with voiceover narration
**Total estimated runtime**: 6-8 minutes
**Audience**: Designers, developers, future project reference
**Tone**: Conversational, opinionated, specific. Not a tutorial - a design story.

---

## Scene 1: The Hook (0:00 - 0:30)

### Screen Action
- Open Dave at `localhost:7777` (or GitHub Pages URL)
- Empty state is visible with a whimsical welcome message
- Pause on the message for 2 seconds

### Narration
> "This is Dave. It's an asset viewer I built in a week. It views 3D models, images, videos, audio, fonts, PDFs, and text files. It runs entirely in the browser - no server, no build step, no tracking. And it has a personality."

### Visual Callout
- Highlight the welcome message text
- Point to "D.A.V.E." in the header: "Dror's Assets Viewing Experience"

### Transition
Quick cut to folder drag-and-drop, grid filling with assets.

---

## Scene 2: The Grid (0:30 - 1:15)

### Screen Action
- Drag a folder with mixed assets into Dave
- Grid populates with tiles (show the `tileAppear` animation)
- Hover over tiles to show the lift effect
- Click through a few different file types in fullscreen

### Narration
> "Drop a folder and Dave figures out what's inside. 3D models get a preview render. Images show thumbnails. Videos play inline. Audio gets a waveform. Every tile does that little slide-up animation - translateY from 20 pixels, 300 milliseconds, ease-out. It's a small thing, but it makes the grid feel alive instead of just... appearing."

### Visual Callout
- Slow-mo replay of tile entrance animation
- Badge colors: point out green (3D), blue (image), purple (video), red (audio)

### Key Design Decision
> "The tile hover lifts 2 pixels with a box shadow. Not 4 pixels, not 8. Two. Enough to feel responsive, not enough to feel jumpy. Material Design says 'elevation communicates hierarchy.' I agree, but subtlety matters."

### Transition
Click the theme button in settings.

---

## Scene 3: The Theme System (1:15 - 2:15)

### Screen Action
- Open settings dropdown (gear icon hover)
- Show the theme picker with 14 theme swatches
- Click through 4-5 themes quickly: Default -> Cyberpunk -> Nord -> Paper -> Dracula
- Show the instant switch (no page reload, no flicker)

### Narration
> "14 themes. Sounds excessive? Maybe. But here's what's interesting - the entire theme system is 5 CSS custom properties. Background, surface, text, border, accent. That's it. Switch those 5 values and every component in the app updates in a single repaint."

> "I could have done class-based theming - `.theme-dark`, `.theme-cyberpunk`, each with hundreds of overrides. Instead, every color in the CSS references these 5 variables. Adding a new theme is literally adding 5 hex codes to a JavaScript object."

### Visual Callout
- Show the CSS custom properties in DevTools changing live
- Highlight the `0.4s` transition on body background

### Key Design Decision
> "The default accent is purple. Not blue - blue is what you get when nobody makes a choice. Purple is deliberate. It's visible on both dark and light backgrounds, it doesn't clash with the file type badge colors, and it says 'someone designed this.' Most tools are blue. Dave is purple."

### Transition
Switch to dark mode, then demonstrate the theme persisting across page reload.

> "And it applies before first paint. There's an inline script in the HTML head that reads localStorage and sets the theme synchronously. No flash of white. No flash of wrong theme. It just works."

---

## Scene 4: Dark-First Philosophy (2:15 - 2:45)

### Screen Action
- Show Dave in default dark mode
- Open Blender or VS Code side by side for comparison
- Switch to light mode briefly

### Narration
> "Dave is dark-first. Light mode exists, but dark is the default. Here's why: the people who use asset viewers are 3D artists. Their tools are all dark - Blender, Maya, Substance, Photoshop. A bright white app in that workflow is like turning on the bathroom light at 3 AM."

> "Also, 3D model previews just look better on dark backgrounds. The contrast is natural. The ambient lighting in the viewer doesn't fight the UI."

### Visual Callout
- Side-by-side: Dave dark vs Dave light with same 3D model open

### Transition
Navigate to the 3D inspector.

---

## Scene 5: The 3D Inspector (2:45 - 4:15)

### Screen Action
- Open a GLB model in fullscreen
- Show the floating toolbar (top-right)
- Toggle wireframe, grid (with colored axes), bounding box
- Open the inspector panel (slide from right)
- Browse through collapsed sections: Stats, Materials, Animations, Export
- Open Materials section, edit a material color
- Open Animations section, scrub through an animation
- Show the export section with texture resize and simplify

### Narration
> "The inspector was the biggest single feature - 6,000 lines across 3 JavaScript files and a CSS file. It uses an adapter pattern: one adapter wraps Google's model-viewer for GLB files, another wraps Three.js directly for FBX. The controller doesn't know which renderer it's talking to."

> "The toolbar floats inside the 3D preview with a backdrop blur. Those icons are 42 pixels - bigger than typical because you're looking at a 3D model, not reading text. You need targets you can hit without thinking."

### Visual Callout
- Point to the custom grid icon: "That's a 3D wireframe cube with RGB axis arrows. Red is X, green is Y, blue is Z. Standard 3D convention, rendered as an inline SVG."
- Show the panel resize handle on left edge

### Key Design Decision (Export)
> "The export system deserves its own mention. You can resize textures from the original down to 256 pixels, simplify the mesh, strip animations, or export just a single animation clip as a skeleton-only GLB. All modifications are non-destructive - the original model is never touched. We save state, modify, export, restore."

> "There's a gotcha with the no-animation export. When you strip all animations, you want the model in its bind pose - the T-pose or A-pose. But model-viewer has an animation mixer that keeps driving the bones even after you call skeleton.pose(). You have to pause the mixer, wait two animation frames, then reset the skeleton. I learned that the hard way."

### Transition
Close fullscreen, switch to showing cloud storage.

---

## Scene 6: Cloud Storage (Client-Side) (4:15 - 5:15)

### Screen Action
- Open settings (gear icon)
- Show S3 credential input
- Browse S3 bucket folders in the cloud browser modal
- Load a folder of assets from S3
- Show assets rendering in the grid from pre-signed URLs
- Paste a Google Drive URL in the search bar

### Narration
> "Dave connects to AWS S3 and Google Drive. Here's the interesting part: it's entirely client-side. No server. No proxy. Your S3 credentials stay in your browser's localStorage. I implemented SigV4 signing - AWS's request authentication protocol - using the Web Crypto API. Every request to S3 is signed in the browser."

> "Google Drive uses Google Identity Services for OAuth. The token flow happens in a popup, the access token stays in memory, and files are fetched directly from the Drive API."

> "Why client-side? Because Dave runs on GitHub Pages. Static hosting. No server to proxy through. And honestly, it's better this way - your credentials never leave your machine."

### Visual Callout
- Point to the cloud browser modal breadcrumbs
- Show a pre-signed URL in DevTools network tab (redact the signature)

### Key Design Decision
> "I actually built the server-side version first. Express routes, AWS SDK, Google APIs - the whole thing. Then I realized: GitHub Pages. Static hosting. No server. I rewrote the entire cloud stack client-side the same day. Lesson learned: always ask 'where will this deploy?' before writing a single line of architecture."

### Transition
Navigate to settings dropdown.

---

## Scene 7: Personality & Delight (5:15 - 6:15)

### Screen Action
- Reload page to show a welcome message
- Reload again to show a different one
- Click the D.A.V.E. logo
- Matrix rain starts, glitch effect erupts, CRT monitor materializes
- Show the retro PC with Dangerous Dave loading
- Click through to show the game
- Exit (CRT shutdown animation with green glow matrix rain)
- Cycle matrix rain modes if time permits

### Narration
> "Dave has 50 welcome messages for the empty state. They're not filler - they teach features. 'Paste S3 URLs in the search bar.' 'Click the tree icon to browse folders.' They also have personality: 'I'm Dave. I view assets. Feed me folders.'"

> "And then there's this."

*(Click logo, pause for CRT animation)*

> "Click the logo and you get Dangerous Dave. The 1990 DOS game by John Romero. The entrance animation is a 4-phase sequence: matrix rain starts, glitch effects erupt, a CRT monitor materializes through the glitch, and the game loads inside it."

> "There are 9 matrix rain modes. The first one is a custom canvas implementation with 8 depth layers creating a parallax effect. The other 8 are from Rezmason's open-source matrix project embedded via iframe."

> "Is this over-engineered for an easter egg? Absolutely. But it's the kind of detail that makes someone say 'wait, did you see this?' And that word-of-mouth is worth more than any feature list."

### Visual Callout
- Slow-mo of the glitch tear effect
- Point to the CRT power LED and "D A V E" brand text
- Show the mute and power buttons on the CRT

### Transition
Cut back to the main app.

---

## Scene 8: No-Build Philosophy & Closing (6:15 - 7:00)

### Screen Action
- Show `index.html` in an editor with the import map visible
- Show a source file in DevTools Sources tab (matches disk file exactly)
- Show GitHub Pages deployment (just a git push)

### Narration
> "Dave has no build step. No webpack, no Vite, no TypeScript. The HTML file has an import map that points to Three.js on a CDN. Every JavaScript file is an ES6 module loaded directly by the browser. The file you see in DevTools is the file on disk."

> "This is a trade-off. No tree-shaking, no minification, no type safety. But also: no build failures. No 'works on my machine.' No CI/CD pipeline to maintain. Clone the repo, open index.html, and you're developing."

> "For a project this size - one developer, specific audience, rapid iteration - simplicity wins over sophistication. Every abstraction you add is a future maintenance burden. Every build tool is a dependency that can break. Dave's only hard dependency is a browser."

### Key Design Decision (Closing)
> "The core philosophy is: make decisions, not defaults. Purple, not blue. Dark, not light. Client-side, not server. Personality, not corporate. Every choice in Dave is deliberate. And when I got it wrong - like building server-side cloud storage before realizing I needed client-side - I rewrote it the same day."

> "That's Dave. An asset viewer with opinions."

### Transition
Fade to black with Dave logo.

---

## Scene 9: End Card (7:00 - 7:15)

### Screen Action
- Dave logo centered on dark background
- GitHub URL below
- "Built with Claude Code" credit

### Narration
> "Dave is open source. Link in the description."

---

## Production Notes

### Key Soundbites (Quotable Moments)

1. "The tile hover lifts 2 pixels. Not 4, not 8. Two. Enough to feel responsive, not enough to feel jumpy."
2. "Blue is what you get when nobody makes a choice. Dave is purple."
3. "A bright white app in that workflow is like turning on the bathroom light at 3 AM."
4. "Every abstraction you add is a future maintenance burden."
5. "Make decisions, not defaults."
6. "Is this over-engineered for an easter egg? Absolutely."
7. "Always ask 'where will this deploy?' before writing a single line of architecture."
8. "5 CSS custom properties. That's the entire theme system."

### Screen Recording Checklist

- [ ] Have a folder with mixed assets ready (3D models, images, videos, audio, fonts, text files)
- [ ] S3 bucket populated with test assets (or mock the browser flow)
- [ ] Record at 1920x1080 or 2560x1440
- [ ] Use Default theme for most scenes, switch themes only in Scene 3
- [ ] Ensure welcome messages are visible (clear localStorage to reset)
- [ ] Test easter egg before recording (loads slowly on first run)
- [ ] Have Blender or VS Code open for side-by-side comparison in Scene 4

### Timing Summary

| Scene | Topic | Duration | Cumulative |
|-------|-------|----------|------------|
| 1 | Hook / Empty State | 0:30 | 0:30 |
| 2 | The Grid | 0:45 | 1:15 |
| 3 | Theme System | 1:00 | 2:15 |
| 4 | Dark-First | 0:30 | 2:45 |
| 5 | 3D Inspector | 1:30 | 4:15 |
| 6 | Cloud Storage | 1:00 | 5:15 |
| 7 | Personality | 1:00 | 6:15 |
| 8 | No-Build / Closing | 0:45 | 7:00 |
| 9 | End Card | 0:15 | 7:15 |

### Post-Production

- Add subtle background music (lo-fi or ambient electronic)
- Add chapter markers for YouTube
- Add zoom-in effects on UI details mentioned in narration
- Add text overlays for key stats (34 commits, 14 themes, 50 messages, etc.)
- Add slow-motion replays for animations (tile entrance, theme switch, CRT boot)
