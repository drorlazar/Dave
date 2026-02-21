# Annotation System

I can draw on your images now. Arrows, circles, text, numbers -- the whole art school dropout toolkit. I'm basically MS Paint if MS Paint had taste and an existential crisis.

## Getting Started

Open any image fullscreen, then press **A** (or click the pen icon in my toolbar). A glowing annotation bar slides up from the bottom. You're in. Pick a tool, click the image, go wild. Press **A** again or **Escape** to leave annotation mode.

Everything you draw lives on a canvas overlay -- your original image stays untouched. I'm non-destructive like that.

## My Tools

| Key | Tool | What It Does |
|-----|------|-------------|
| **V** | Select | Click to select stuff. Move, resize, rotate, delete -- the boring-but-essential one |
| **P** | Pen | Freehand drawing. Channel your inner whiteboard energy |
| **L** | Line | Straight line. Point A to point B. I don't judge the angle |
| -- | Arrow | Line with an arrowhead. For when you need to say "look HERE" |
| -- | Rectangle | Box. Supports fill, stroke, or both |
| -- | Circle | Ellipse, technically -- but "circle tool" sounds better |
| **T** | Text | Click to place a text editor. Type, hit Enter. Courier New on a dark pill because I have standards |
| **N** | Number | Click to drop numbered points -- 1, 2, 3... Great for callouts and step-by-step guides |
| **H** | Highlighter | Semi-transparent freehand stroke. Like dragging a marker across the screen |

## Drawing

Most tools work by **click-and-drag** -- click where you want to start, drag to shape it, release to commit. Pen and Highlighter follow your cursor. Text and Number are **click-to-place** -- one click, done.

I won't let you draw outside the actual image content. If there's letterboxing (those dark bars on the sides), I'll keep your strokes within bounds. You're welcome.

## Selection & Editing (V)

Switch to Select with **V**, then click any annotation. You'll see:

- **Dashed box** around it -- that's me saying "got it"
- **8 handles** (corners + edges) -- drag to resize
- **Rotation handle** (circle above top-center) -- drag to spin it. Hold **Shift** to snap every 15 degrees
- **Red X** (top-right) -- click to delete. Or just press **Delete** / **Backspace**

**Move** -- click the annotation body and drag it somewhere else.

**Edit attributes** -- while something's selected, my toolbar syncs to its properties. Change the color, width, fill, or stroke toggle and it updates the selected annotation. All undo-able.

**Edit text or numbers** -- double-click a text or number annotation. I'll open the editor with the content pre-selected so you can retype it. Enter to save, Escape to bail. Clear the text entirely and I'll delete the annotation -- I don't keep empty ones around.

## The Toolbar

From left to right:

- **Tool buttons** -- pick your weapon (or press the keyboard shortcut)
- **Fill toggle** (paint bucket) -- enables fill for shapes. Rectangles, circles, highlighter
- **Stroke toggle** (paintbrush) -- enables the outline. At least one of fill/stroke stays on -- I'm not going to let you draw invisible annotations
- **Color swatches** -- 7 hand-picked colors: Alert (red), Dave (green), Curious (cyan), Sassy (pink), Warning (yellow), Clean (white), Existential (purple). Plus a custom color picker if my palette isn't enough for you
- **Width slider** -- 1-20px. Also adjustable with **[** and **]** keys
- **Undo / Redo / Clear / Visibility** -- the usual suspects. I track up to 50 actions

## Number Tool

This one's special. Press **N**, then click anywhere on the image. I'll drop a numbered circle -- 1, then 2, then 3, auto-incrementing. Each one is a dark circle with a colored ring and number. Clean, readable, professional.

Double-click a number to edit it. Resize it and the circle scales. Clear all annotations and the counter resets to 1.

## Export

When you export an image (E key), your annotations come with it -- rendered at full resolution. I map everything from my internal coordinate system to pixel space, scale the stroke widths, apply rotations. The exported image looks exactly like what you see on screen.

Also: **Ctrl+C** copies the annotated image to your clipboard. I'm helpful like that.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| A | Toggle annotation mode |
| V | Select tool |
| P | Pen |
| L | Line |
| T | Text |
| N | Number |
| H | Highlighter |
| [ / ] | Decrease / increase stroke width |
| Delete | Delete selected annotation |
| Escape | Deselect or close editor |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Shift + rotate | Snap to 15-degree increments |

## Things I'm Quietly Proud Of

- **Zoom-aware** -- I redraw annotations in real-time as you zoom and pan. They stay exactly where you put them
- **Rotation math** -- I do aspect-ratio-aware coordinate transforms so hit-testing works at any angle. You don't need to care about this, but I do, every frame
- **Theme-aware** -- my selection overlay and UI colors follow your theme. Switch themes mid-annotation -- I'll keep up
- **Bounds clamping** -- I detect letterboxing from `object-fit: contain` and keep your strokes inside the actual image. No accidental drawing in the void
- **Everything's undo-able** -- moves, resizes, rotations, color changes, text edits, deletions. All of it. 50 levels deep
