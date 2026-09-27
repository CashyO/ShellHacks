# ProjectGraph for VS Code

A living mind map of the **local** repo open in VS Code. It never talks to GitHub: the extension reads your
checkout and sends it to the ProjectGraph app (`/api/local/*`), which uses Gemini.

- **Map This Repository** analyzes your local files and draws the first ideas.
- **Every commit grows the map.** No push needed. Ideas your commit implemented turn green, work you did
  that had no bubble gets detected, and 2–3 follow-up ideas sprout.
- **A passive agent watches your editor.** The map docks beside your code. Bubbles that touch the file you're
  in get a cyan ring as you move around, and the **((•)) Agent** panel shows where you are
  (`store.js › dueSoon :9`). When you pause (10 s) or save, the agent reads your current function, selection,
  errors in the file, recent files and uncommitted diff, says what it thinks you're doing, and pitches 0–2
  ideas for that moment. They sprout on the map and in "Pitched for you" (✕ dismisses one). It sends at most
  one request per 45 s, and nothing when you're still in the same function with the same changes.
- Click a file on an idea's detail panel to open it in the editor. **Expand** works on local maps too.
  Build it / Open PR are hidden for local maps: you build in your editor and commit.

## Use it

1. Start the app in the repo root with `npm run dev`. `.env.local` needs `MOCK_MODE=false` and a Gemini key.
2. Open your project folder (a git repo) in VS Code.
3. Click **ProjectGraph** in the status bar, then **Map This Repository**.
4. Code, pause, commit, and watch the map grow.

| Command | What it does |
|---|---|
| ProjectGraph: Open Map | Opens the map for this repo (offers to create it) |
| ProjectGraph: Map This Repository | Creates a new map from the current files |
| ProjectGraph: Suggest Ideas From My Changes | Asks for ideas now, skipping the wait |
| ProjectGraph: Open Map in Browser | Opens the same map outside VS Code |

Settings: `projectgraph.url`, `projectgraph.passiveIdeas`, `projectgraph.ideaDelaySeconds`,
`projectgraph.minIdeaIntervalSeconds`, `projectgraph.notifications`. The output channel **ProjectGraph** logs
errors.

## Develop and package

Press **F5** in this folder to run it in a test window. To build an installable file:

```bash
cd vscode-extension && npx @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license
```
