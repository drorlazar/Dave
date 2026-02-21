# Dave Show — Claude Code Skill

Connect your Claude Code to Dave so it can show you images, 3D models, videos, and other files it creates — right in your browser. You can annotate, zoom, compare, and give visual feedback.

## Install (give this to Claude Code)

Open Claude Code and say:

> Install the Dave skill from this folder. Copy the `dave-show` folder into `~/.claude/skills/` and make `dave-helper.cjs` executable.

Or run this yourself in your terminal:

```bash
mkdir -p ~/.claude/skills/dave-show
cp dave-show/SKILL.md ~/.claude/skills/dave-show/
cp dave-show/dave-helper.cjs ~/.claude/skills/dave-show/
chmod +x ~/.claude/skills/dave-show/dave-helper.cjs
```

That's it. The skill is installed.

## How it works

1. **Claude Code starts a tiny local server** (dave-helper.cjs) on your machine
2. **Dave opens in your browser** at https://drorlazar-sett.github.io/Dave/
3. **Dave connects to your local server** to load files from your disk
4. **You see the files** — zoom, annotate, compare, inspect 3D models

No accounts. No uploads. Files never leave your machine.

## What you can tell Claude Code

Once installed, just talk naturally:

- "Show me that image you just created"
- "Open this in Dave"
- "Let me annotate this mockup"
- "Compare these three versions side by side"
- "Show me the 3D model"

Claude Code will handle the rest.

## Requirements

- **Node.js** (any recent version) — needed to run the local file server
- **Claude Code** — the CLI tool from Anthropic
- A modern browser (Chrome, Firefox, Safari, Edge)

## Troubleshooting

**"Connection refused" errors**
The helper server isn't running. Claude Code starts it automatically, but you can also start it manually:
```bash
node ~/.claude/skills/dave-show/dave-helper.cjs
```

**Files don't appear in Dave**
Make sure you're using the link Claude Code gives you, not just going to the Dave site directly. The link includes a `?server=localhost:7778` parameter that tells Dave where to find your files.

**"File not found" errors**
Claude Code needs to use absolute paths (like `/Users/you/project/image.png`), not relative ones.

## Supported file types

Images (.png, .jpg, .webp, .gif, .svg, .bmp), 3D models (.glb, .gltf, .fbx, .obj, .stl), video (.mp4, .webm, .mov), audio (.mp3, .wav, .ogg), fonts (.ttf, .otf, .woff2), and documents (.pdf, .txt, .md, .json, .csv).

## What's in this package

```
dave-skill/
  README.md           ← You're reading this
  dave-show/
    SKILL.md          ← Instructions Claude Code reads
    dave-helper.cjs   ← Local file server (zero dependencies)
```
