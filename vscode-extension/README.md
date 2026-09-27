# Spitball for VS Code

A living mind map of the **local** repo open in VS Code. It never talks to GitHub: the extension reads your
checkout and sends it to the Spitball app (`/api/local/*`), which uses Gemini.

- **Map This Repository** analyzes your local files and draws the first ideas.
- **Every commit grows the map.** No push needed. Ideas your commit implemented turn green, work you did
  that had no bubble gets detected, and 2–3 follow-up ideas sprout.
- **A passive agent watches your editor.** The map docks beside your code. Bubbles that touch the file you're
  in get a cyan ring as you move around, and the **((•)) Agent** panel shows where you are
  (`store.js › dueSoon :9`). When you pause (10 s) or save, the agent reads your current function, selection,
  errors in the file, recent files and uncommitted diff, says what it thinks you're doing, and pitches 0–2
  ideas for that moment. They sprout on the map and in "Pitched for you" (✕ dismisses one). It sends at most
  one request per 45 s, and nothing when you're still in the same function with the same changes.
- **Build it** on any bubble: Gemini writes the change from your current files, VS Code shows it as a diff,
  and **Apply** writes it into your working tree. Then test and commit, and the bubble turns green.
  **Open files** jumps to the idea's code; **Expand** breaks an idea into smaller ones. (Open PR is GitHub-only.)

## Install

> **Upgrading from ProjectGraph (0.6.x or earlier)?** The extension was renamed, so VS Code sees it as a new
> extension: uninstall "ProjectGraph", install Spitball, then run **Spitball: Connect Existing Map** in each repo
> and paste its map link (the old maps are all still there). Old `projectgraph.*` settings keep working.

Download `spitball-<version>.vsix` from the
[Releases page](https://github.com/CashyO/ShellHacks/releases), then in VS Code run
**Extensions: Install from VSIX…** (⌘⇧P / Ctrl+Shift+P) and pick the file. Or from a terminal:

```bash
code --install-extension spitball-0.7.0.vsix
```

The extension is a front end: it needs the Spitball app running (next section). Your code snippets and
diffs are sent to that app, which sends them to Gemini.

## Use it

1. Start the app in the repo root with `npm run dev`. `.env.local` needs `MOCK_MODE=false` and a Gemini key.
2. Open your project folder (a git repo) in VS Code.
3. Click **Spitball** in the status bar, then **Map This Repository**.
4. Code, pause, commit, and watch the map grow.

| Command | What it does |
|---|---|
| Spitball: Open Map | Opens the map for this repo in an editor tab (offers to create it) |
| Spitball: Show Map in Sidebar | Opens the Mind Map view (drag it to the secondary side bar) |
| Spitball: Map This Repository | Creates a new map from the current files |
| Spitball: Connect Existing Map | Attaches this repo to a map you already have (paste its link or id) |
| Spitball: Suggest Ideas From My Changes | Asks for ideas now, skipping the wait |
| Spitball: Open Map in Browser | Opens the same map outside VS Code |

Settings: `spitball.url`, `spitball.passiveIdeas`, `spitball.ideaDelaySeconds`,
`spitball.minIdeaIntervalSeconds`, `spitball.notifications`. The output channel **Spitball** logs
errors.

## Develop and package

Press **F5** in this folder to run it in a test window. To build an installable file:

```bash
cd vscode-extension && npx @vscode/vsce package --no-dependencies --skip-license
```
