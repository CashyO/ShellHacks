# Changelog

## 0.5.1 (2026-09-27)

### Fixes
- Clear errors instead of "Request failed (404)": says when the app can't be reached, or when it's an older
  version without the local-repo routes (update it and restart `npm run dev`).

## 0.5.0 (2026-09-26)

First release of ProjectGraph for VS Code.

### Features
- **Map This Repository**: analyzes the local git repo open in VS Code and draws a mind map of ideas.
  No GitHub access needed; the extension reads your checkout directly.
- **Grows on every commit**: ideas your commit implemented turn green, new work gets detected, and
  follow-up ideas sprout. No push needed.
- **Passive agent**: watches the current file, the function under your cursor, your selection, errors
  and uncommitted changes. When you pause, it says what you seem to be doing and pitches 0–2 ideas for
  that moment. At most one request per 45 s; nothing is sent when nothing changed.
- **Live map beside your code**: a ProjectGraph sidebar (movable to the secondary side bar) or an
  editor tab. Bubbles for your current file get a live ring; the Agent panel shows thoughts and pitches.
- Click a file on an idea to open it in the editor; Expand and Copy prompt work inside VS Code.
- Settings for the app URL, passive ideas, timing and notifications.

### Fixes
- Copy prompt works inside VS Code webviews (falls back to VS Code's clipboard).
