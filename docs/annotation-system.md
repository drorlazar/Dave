# Annotation System

Canvas-based annotation overlay for the Dave image viewer. All coordinates are stored in normalized image space (0-1) so annotations scale with the image.

## Tools

| Tool | Icon | Key | Description |
|------|------|-----|-------------|
| Select | `fa-arrow-pointer` | V | Select, move, resize, rotate, delete annotations |
| Pen | `fa-pen-fancy` | P | Freehand drawing |
| Line | `fa-minus` | L | Straight line |
| Arrow | `fa-arrow-right` | - | Line with filled arrowhead |
| Rectangle | `fa-square` | - | Rectangle (supports fill + stroke) |
| Circle | `fa-circle` | - | Ellipse (supports fill + stroke) |
| Text | `fa-font` | T | Click to place inline text editor |
| Number | `fa-hashtag` | N | Click to place sequentially numbered points |
| Highlighter | `fa-highlighter` | H | Semi-transparent freehand stroke |

## Toolbar Controls

### Color
- **Palette swatches**: 7 preset colors (Alert, Dave, Curious, Sassy, Warning, Clean, Existential)
- **Custom color picker**: Any color via native input
- When a stroke is selected, changing color edits the selected stroke; otherwise sets the default

### Stroke Width
- Range slider (1-20px)
- Keyboard: `[` decreases, `]` increases
- Edits selected stroke when in select mode

### Fill / Stroke Toggles
- **Fill** (paint bucket icon): Toggles fill for shapes (rect, circle, highlighter)
- **Stroke** (paintbrush icon): Toggles stroke outline
- At least one must be enabled at all times
- When a stroke is selected, toggles apply to that stroke

### Actions
- **Undo** (Ctrl+Z): Action-based undo
- **Redo** (Ctrl+Shift+Z): Action-based redo
- **Clear**: Removes all annotations (each becomes an undo-able delete)
- **Toggle visibility** (eye icon): Show/hide all annotations

## Selection System (V)

Click any annotation to select it. The selection overlay shows:

- **Dashed bounding box** in theme accent color
- **8 resize handles** (corners + edge midpoints) - drag to scale
- **Rotation handle** (circle above top-center) - drag to rotate freely, hold Shift for 15-degree snaps
- **Delete button** (red circle with X above top-right) - click to remove

### Move
Click and drag the stroke body to reposition.

### Resize
Drag any of the 8 handles. The stroke scales proportionally from the opposite corner/edge. Text and number annotations scale their font size.

### Rotate
Drag the rotation handle above the bounding box. All rendering and hit testing accounts for rotation using aspect-ratio-aware coordinate transforms.

### Delete
- Click the red X button on the selection overlay
- Press Delete or Backspace with a stroke selected

### Attribute Editing
When a stroke is selected, the toolbar syncs to show its properties. Changing color, width, fill, or stroke toggles edits the selected annotation with undo support.

### Text / Number Editing
Double-click a text or number annotation to open the inline editor pre-populated with the current content. Press Enter to commit, Escape to cancel. Clearing all text deletes the annotation.

## Number Tool (N)

Click-to-place numbered points:

1. Each click creates and immediately commits a numbered annotation
2. Numbers auto-increment (1, 2, 3, ...)
3. Counter resets when clearing all annotations
4. Visual: dark semi-transparent circle background + colored border ring + colored number text (Courier New, bold, centered)
5. Supports move, resize (scales circle), rotate, delete, and double-click editing

## Bounds Clamping

Annotations are constrained to the actual image content area. The system detects `object-fit: contain` letterboxing by computing the image's natural aspect ratio against the element's rendered size, ensuring strokes can't be placed in padding areas.

## Theme Integration

- Selection overlay uses `--theme-accent` CSS variable
- Background colors use `--theme-bg`
- Accent color is cached and invalidated on `dave:themeChange` events
- Text and number annotations use dark semi-transparent backgrounds for readability on any image

## Export

`renderToCanvas(targetCanvas, targetW, targetH)` renders all annotations to an export canvas at full image resolution. Coordinates are mapped from normalized (0-1) space to pixel space, stroke widths are scaled proportionally, and rotation transforms are applied.

## Undo / Redo

Action-based system (max 50 entries) supporting:

- `add` - new stroke created
- `delete` - stroke removed
- `move` - position change
- `resize` - scale change
- `rotate` - rotation change
- `edit` - attribute change (color, width, text, fill/stroke toggles)

Each action stores before/after snapshots for full reversibility.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| P | Pen tool |
| L | Line tool |
| T | Text tool |
| N | Number tool |
| H | Highlighter tool |
| [ | Decrease stroke width |
| ] | Increase stroke width |
| Delete / Backspace | Delete selected |
| Escape | Deselect / close text editor |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Shift (while rotating) | Snap to 15-degree increments |
