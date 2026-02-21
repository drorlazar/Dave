---
name: dave-show
description: Use when you create or work with visual files (images, 3D models, videos) and want to show them to the user through Dave - Dror's Asset Viewing Experience. Also use when the user says "show me", "open in Dave", "view this file", "let me annotate", or when you generate screenshots, renders, diagrams, or any visual output. Triggers on file creation of .png, .jpg, .webp, .glb, .fbx, .mp4, .svg and other visual formats.
---

# Dave Show - Display Files in Dave

Show files you create to the user through Dave, a powerful asset viewer with annotation, zoom, 3D model inspection, and more. Works with images, 3D models, video, audio, fonts, and documents.

## Quick Start

```bash
# 1. Ensure helper is running
node ~/.claude/skills/dave-show/dave-helper.cjs &

# 2. Show a file (opens in browser fullscreen)
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/absolute/path/to/file.png"], "fullscreen": 0}'

# 3. Or open directly in browser
open "https://drorlazar-sett.github.io/Dave/?server=localhost:7778&file=/path/to/file.png"
```

## Setup (automatic)

Before sending commands, ensure the helper server is running:

```bash
# Check if helper is already running
curl -s http://localhost:7778/api/control/events --max-time 1 -o /dev/null 2>&1
# If that fails (exit code != 0), start it:
node ~/.claude/skills/dave-show/dave-helper.cjs &
sleep 1
```

The helper is a zero-dependency Node.js script that serves local files to Dave's browser UI.

## API Reference

All endpoints are on `http://localhost:7778`.

### Show Files

Load files into Dave's grid. Set `fullscreen` to open one file immediately.

```bash
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{
    "files": ["/path/to/image1.png", "/path/to/image2.jpg"],
    "fullscreen": 0
  }'
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `files` | string[] | required | Absolute paths to files |
| `fullscreen` | number | -1 | Index of file to open fullscreen (-1 = grid only) |
| `clear` | boolean | true | Clear existing files first |

### Open Annotation Mode

Opens annotation tools so the user can draw on an image. Use this when you want user feedback on a design, screenshot, or mockup.

```bash
curl -s -X POST http://localhost:7778/api/control/annotate \
  -H 'Content-Type: application/json' \
  -d '{"tool": "arrow", "color": "#ff3333"}'
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `fileIndex` | number | current | Index of image file to annotate |
| `tool` | string | "pen" | Tool: pen, line, arrow, rect, circle, text, number, highlighter |
| `color` | string | "#ff3333" | Annotation color (hex) |

### Navigate

Control which file is shown, zoom level, etc.

```bash
curl -s -X POST http://localhost:7778/api/control/navigate \
  -H 'Content-Type: application/json' \
  -d '{"action": "next"}'
```

| Action | Description |
|--------|-------------|
| `next` | Next file in viewer |
| `prev` | Previous file |
| `close` | Close fullscreen |
| `fullscreen:N` | Open file at index N fullscreen |
| `page:N` | Go to grid page N |
| `zoom:fit` | Fit image to screen |
| `zoom:100` | 100% zoom |

### Read State

Get current Dave state — what's loaded, fullscreen status, annotations.

```bash
curl -s http://localhost:7778/api/control/state
```

Returns JSON with: `loaded` (files, page), `fullscreen` (active, fileName), `annotation` (active, tool, strokes), `search`.

**Important**: This requires Dave to be open in a browser with the SSE connection active. If no browser is connected, this returns a timeout error after 5 seconds.

### Serve a File

Direct file access (used internally by Dave, but available if needed):

```bash
curl -s "http://localhost:7778/api/file?path=/absolute/path/to/file.png" -o output.png
```

## Common Workflows

### Show a generated image for review
```bash
# After generating/saving an image
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/path/to/generated-image.png"], "fullscreen": 0}'
```

### Show image and ask user to annotate feedback
```bash
# Show the image
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/path/to/mockup.png"], "fullscreen": 0}'
sleep 1
# Open annotation with arrow tool
curl -s -X POST http://localhost:7778/api/control/annotate \
  -H 'Content-Type: application/json' \
  -d '{"tool": "arrow", "color": "#ff3333"}'
# Tell the user: "I've opened your mockup in Dave with annotation tools.
# Draw arrows or circles on anything you want changed, then tell me when done."
# Later, read annotations:
curl -s http://localhost:7778/api/control/state
```

### Compare multiple images side by side
```bash
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/path/v1.png", "/path/v2.png", "/path/v3.png"], "fullscreen": -1}'
```

### Show a 3D model
```bash
curl -s -X POST http://localhost:7778/api/control/show \
  -H 'Content-Type: application/json' \
  -d '{"files":["/path/to/model.glb"], "fullscreen": 0}'
```

## Supported File Types

| Category | Extensions |
|----------|-----------|
| Images | .png, .jpg, .jpeg, .gif, .webp, .svg, .bmp, .tiff, .ico |
| 3D Models | .glb, .gltf, .fbx, .obj, .dae, .stl, .ply, .3ds |
| Video | .mp4, .webm, .mov, .avi, .mkv |
| Audio | .mp3, .wav, .ogg, .flac, .m4a |
| Fonts | .ttf, .otf, .woff, .woff2 |
| Documents | .pdf, .txt, .md, .json, .csv |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Connection refused" | Helper not running. Start with `node ~/.claude/skills/dave-show/dave-helper.cjs &` |
| "File not found" | Use absolute paths, not relative |
| State returns timeout | Dave must be open in a browser. Open https://drorlazar-sett.github.io/Dave/?server=localhost:7778 |
| Files don't appear in Dave | Check browser console for CORS errors. Helper must be running on port 7778 |
