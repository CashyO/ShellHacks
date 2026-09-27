# ProjectGraph

**Your codebase becomes a map you steer, not a chat you type into.**

ProjectGraph turns a GitHub repo into a living mind map of what to build next — grounded in your actual files, respecting the conventions your team already wrote down, updated by your commits, and executable: click a bubble and get a real pull request.

## Why not just prompt Claude Code?

For "fix this one thing right now," a chat tool wins — it's more flexible and there's no context switch. That's not what this replaces.

What a chat session can't do is **remember, across time and across people, what your team already decided.** Every idea Claude Code has ever suggested you, and every time you said "no, not like that, because X," evaporates the moment the terminal closes. ProjectGraph writes that down automatically:

- **A decision log that isn't a Slack thread nobody can find.** Reject an idea and say why — it's attributed and permanent, visible to every teammate, in the [**Decisions**](#decisions-log) view. Nobody re-litigates a call someone already made.
- **It runs without being asked.** Push a commit and the map updates on its own — merged PRs turn ideas green, and new ideas sprout from what just shipped. A chat session only ever answers when you type into it.
- **It respects rules your team already wrote down.** If your repo has an `ARCHITECTURE.md`, `CONTRIBUTING.md`, or an ADR, every suggestion is checked against it — and an idea that would violate a documented convention gets flagged or dropped instead of suggested anyway. [See it happen for real](#it-actually-reads-your-conventions).
- **Every idea cites a real file or function.** No "add dark mode," no generic filler — the moat is suggestion quality, enforced by the prompts themselves, not a disclaimer.

## The core loop

```
push code → map grows → click a bubble → diff → PR opens → merge → bubble turns green → new ideas sprout
```

## Features

| | |
|---|---|
| **Living mind map** | react-force-graph-2d canvas. Color = idea type, size = effort, dashed/pulsing/solid/green = status. |
| **Grounded ideas** | Every suggestion names a real file or function via Gemini structured output, validated end to end with zod. |
| **Convention-aware** | Reads your repo's own `ARCHITECTURE.md`/`CONTRIBUTING.md`/ADRs and treats them as binding, not optional. |
| **Build → PR** | Gemini writes the full new file contents (never a patch — models write broken patches), the server computes the diff, you review it, then it opens a real GitHub PR. |
| **Sync loop** | Merge a PR → the node turns green. Push a hand-written commit → the map *detects* what you built and sprouts follow-up ideas from it. |
| **GitHub sign-in** | OAuth, encrypted session cookie, a searchable picker of your own repos — PRs open as you, including on private repos. |
| **Manual planning** | Add an idea by hand, wire up "depends on" edges between ideas (a static dashed arrow, not a hover gimmick), reject with a reason. |
| **Decisions log** | Every rejected idea, who rejected it, and why — the one place that record is visible, since rejected ideas are hidden from the graph itself. |
| **VS Code extension** | A passive agent that watches your local editor and pitches ideas as you code — see [`vscode-extension/`](vscode-extension/README.md). |
| **AI response cache** | Mongo-backed; the same prompt returns the same answer instantly, so a demo (or a rerun) doesn't depend on Gemini's mood. |

### It actually reads your conventions

This isn't a claim — it happened on a real, uncached Gemini call against the project's own demo repo. After adding an `ARCHITECTURE.md` saying *"do not add authentication or a real database — this is a single-user local tool by design,"* one returned idea's rationale read:

> "the POST /events route sends req.body directly to db.insert without validating dates or checking required fields against EVENT_FIELDS, **violating the ARCHITECTURE.md validation convention**."

No idea suggested adding auth or a database. It just followed the rules already written down.

## Quick start (no keys needed)

Requires Node 20+.

```bash
git clone https://github.com/CashyO/ShellHacks.git
cd ShellHacks
npm install
cp .env.example .env.local     # MOCK_MODE=true by default
npm run dev                    # http://localhost:3000
```

Click **Try demo**, or open `http://localhost:3000/map/demo`. `npm run build` must pass before you push.

## Real mode

Set the keys in `.env.local` (see `.env.example` and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9) and set `MOCK_MODE=false`. Never commit `.env.local`.

### GitHub sign-in (connect your account and pick a repo)

1. Create an OAuth App at https://github.com/settings/developers → **New OAuth App**.
   - Homepage URL: your app URL. **Authorization callback URL: `<app url>/api/auth/callback`**.
   - GitHub allows one callback URL per app — make one app for `http://localhost:3000/api/auth/callback` and a separate one for production.
2. Put the Client ID and a generated secret in `.env.local` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, and set `SESSION_SECRET` to any random 32+ character string.
3. Restart the dev server. The home page shows **Connect GitHub**; after approving, pick one of your repos.

Without sign-in, the app falls back to a shared `GITHUB_TOKEN` for public-repo reads and PRs on repos that token can write to — the home page shows exactly which sign-in variables are missing if any.

### VS Code extension

A `.vsix` isn't published yet — build it yourself:

```bash
cd vscode-extension
npx @vscode/vsce package --no-dependencies --skip-license
code --install-extension projectgraph-*.vsix
```

Needs the app running (`npm run dev`, `MOCK_MODE=false`, a working Gemini key). See [`vscode-extension/README.md`](vscode-extension/README.md).

## Deploying (Vercel / DigitalOcean)

Set the same variables in the host's environment settings, plus `MONGODB_URI`. **`MOCK_MODE` must be `false`** in production — the home page shows an amber banner if it's on, since with it on every repo shows the built-in sample map. Serverless hosts forget in-memory data between requests, so real mode needs `MONGODB_URI`. Set `APP_URL` to the public URL if sign-in redirects look wrong.

## Stack

Next.js (App Router) · TypeScript · Tailwind · react-force-graph-2d · Gemini (`@google/genai`, structured output, zod-validated) · MongoDB Atlas · Octokit · GitHub OAuth (no auth library — a hand-rolled AES-GCM encrypted cookie).

## Docs

Start at [`docs/index.md`](docs/index.md) — it says where every kind of information lives, for humans and coding agents alike. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the full technical spec and API contract; [`docs/CONTEXT.md`](docs/CONTEXT.md) is the why.

## Who owns what

See [`docs/PLAN.md`](docs/PLAN.md) (roles) and `docs/ARCHITECTURE.md` §4 (files). Work on your own branch and merge small PRs into `main`.
