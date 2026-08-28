# Video Editor Revival & Polish — 2026-08-28

Context: The video editor (built on branch `video-editor`, never merged) was merged into
`claude/dave-video-editing-feature-745ba3` (merge commit 961f48a; conflicts in index.html
and text_preview.css resolved by keeping both sides). A code review found the feature
wired end-to-end but with real bugs and UX gaps. This plan is the fix list.

## Bugs (must fix)

1. **Crop commit semantics** — `VideoCrop.deactivate()` (video_crop.js:58-72) always writes
   `cropRect` back, so Reset doesn't clear crop and Cancel commits it. Add Apply/Cancel
   buttons; only commit on Apply; `resetAll()` must deactivate before nulling.
2. **Dirty check bypassed** — backdrop click and nav-strip clicks (ui.js:530,540,544) call
   `exitFullscreen()` directly, discarding edits. Route through `requestClose()`; hide
   `.fullscreen-nav` strips under `.ve-fullscreen`. Backdrop-click-close + 3s toolbar
   auto-hide combine to make any late click close the editor (reproduced in browser).
3. **Undecodable video** — `_waitForMetadata` resolves on `error`; avi/mkv give a black
   dead editor. Reject and render the `.fullscreen-error` pattern.
4. **Export**: progress math wrong with concat (precompute durations), first-frame race
   (`playing` event gate), leaked object URLs, silent audio drop. Add audio via
   AudioContext→MediaStreamDestination merged into canvas stream; fall back to a clear
   "no audio" label if capture fails.
5. **Hacky close** — toolbar X synthesizes an Escape KeyboardEvent; call `requestClose()`.

## UX improvements

6. **Discovery** — video tiles' pencil currently opens online-video-cutter.com
   (externalEditors.js). Point video at the internal editor instead.
7. **Trim buttons** — bare `[` `]` glyphs; add text labels ("Trim In"/"Trim Out").
8. **Help overlay** — `?` opens a keyboard-shortcut sheet (14 shortcuts, currently
   discoverable only via title tooltips).
9. **Export panel honesty** — remove the dead single-option Format row (label output
   WebM), show estimated export time (real-time pipeline), warn to keep tab focused,
   surface errors inline in the panel.
10. **Notification fallback** — `_showNotification` no-ops without `window.errorHandler`.

## Deferred (queued, not this pass)

Undo/redo stack, timeline thumbnails, concat thumbnails/preview, ARIA/keyboard for
timeline & crop handles, Pointer Events for touch.

## Ship path

Fix → browser-test on localhost:7777 (remote-control /api/control/show to load videos) →
update release log in SettingsModal.js → PR to main → merge → publish.
