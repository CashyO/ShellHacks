# Spitball — a living mind map of what to build next

## 🚀 Overview
Spitball turns a GitHub repo (or a local checkout, via the VS Code extension) into a living mind map of what to build next — grounded in your actual files, respecting the conventions your team already wrote down, updated automatically by your commits, and executable: click a bubble and get a real pull request.

**Why not just prompt Claude Code?** For "fix this one thing right now," a chat tool wins — more flexible, no context switch. What a chat session can't do is remember, across time and across people, what your team already decided. Spitball writes that down automatically: reject an idea and say why, and it's permanent and visible to every teammate; push a commit and the map updates on its own, merged PRs turn ideas green, and new ideas sprout from what just shipped — no one has to ask.

## ✨ Features
- **Living mind map**: a force-directed graph — color = idea type, size = effort, dashed/pulsing/solid/green = status
- **Grounded ideas**: every suggestion cites a real file or function via Gemini structured output, validated end to end with zod
- **Convention-aware**: reads your repo's own `ARCHITECTURE.md`/`CONTRIBUTING.md`/ADRs and treats them as binding, not optional
- **Build → PR**: Gemini writes the full new file contents, the server computes the diff, you review it, then it opens a real GitHub PR
- **Sync loop**: merge a PR → the node turns green; push a hand-written commit → the map *detects* what you built and sprouts follow-up ideas
- **GitHub sign-in**: OAuth, encrypted session cookie, a searchable picker of your own repos — PRs open as you, including on private repos
- **Manual planning**: add an idea by hand, select several with Ctrl/Cmd-click and build them all at once, reject with a reason
- **Decisions log**: every rejected idea, who rejected it, and why — the one place that record is visible
- **VS Code extension**: a passive agent that watches your local editor, pitches ideas as you code, and can build and apply changes to your working tree directly — no GitHub required for local repos
- **AI response cache**: Mongo-backed, so the same prompt returns the same answer instantly

## 🏗️ Tech Stack

### Backend
- **Next.js (App Router)**: API routes and server rendering, one deploy
- **Gemini API** (`@google/genai`): structured output, JSON-schema validated
- **zod**: every AI response is validated before it touches the database
- **MongoDB Atlas**: persisted maps + AI response cache
- **Octokit**: real GitHub reads, commits, and pull requests
- **Hand-rolled GitHub OAuth**: AES-GCM encrypted session cookie, no auth library

### Frontend
- **React 19 + TypeScript**
- **react-force-graph-2d**: canvas-based mind map
- **Tailwind CSS**

### VS Code Extension
- Plain `vscode` API, no bundler — reads your local git checkout and talks to the same Next.js API

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 20 or higher
- A Google Gemini API key ([get one here](https://aistudio.google.com/apikey))
- A MongoDB Atlas cluster (free tier is enough) — optional for local UI work, required for real data to persist

### 1. Clone the Repository
```bash
git clone https://github.com/CashyO/ShellHacks.git
cd ShellHacks
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env.local
```
`.env.local` ships with `MOCK_MODE=true`, so it runs with **no keys at all**. To use real repos, set `GEMINI_API_KEY`, `GEMINI_MODEL`, `MONGODB_URI`, and `MOCK_MODE=false` — see `.env.example` for every variable and `docs/ARCHITECTURE.md` §9 for details.

### 4. Start the App
```bash
npm run dev
```
Open `http://localhost:3000`.

### 5. (Optional) GitHub Sign-In
1. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**. Callback URL: `http://localhost:3000/api/auth/callback`.
2. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and any random 32+ character `SESSION_SECRET` to `.env.local`.
3. Restart the dev server — **Connect GitHub** appears on the home page.

### 6. (Optional) VS Code Extension
Download the `.vsix` from [Releases](https://github.com/CashyO/ShellHacks/releases/tag/vscode-v0.5.1), then **Extensions: Install from VSIX…** in VS Code, or:
```bash
code --install-extension spitball-0.5.1.vsix
```
Needs the app running locally with `MOCK_MODE=false` and a working Gemini key. See [`vscode-extension/README.md`](vscode-extension/README.md).

## 🎯 Usage

1. **Start the app** (`npm run dev`, port 3000)
2. **Open your browser** to `http://localhost:3000`
3. **Connect GitHub and pick a repo**, or click **Try demo**
4. **Click any bubble** to see why it's grounded in your code — expand it, build it, or reject it with a reason
5. **Build an idea** → review the diff → **Open PR** → merge on GitHub → watch the node turn green and new ideas sprout

### Example Repository URLs
- `https://github.com/expressjs/cors`
- Any public repo, or your own once signed in

## 🔧 API Endpoints

| Route | Does |
|---|---|
| `POST /api/analyze` | Snapshot a repo → Gemini analyze → save a new map |
| `GET /api/maps/[id]` | Load a map |
| `PATCH /api/maps/[id]` | Change a node's status (e.g. reject, with a reason) |
| `POST /api/nodes` | Manually add an idea |
| `POST /api/expand` | Generate 3–5 follow-up ideas for a node |
| `POST /api/build` | Gemini writes the change; server computes the diff |
| `POST /api/pr` | Open a real GitHub PR from the stored proposal |
| `POST /api/sync` | Compare commits; mark shipped, detect new work, sprout ideas |
| `GET /api/repos` | The signed-in user's repos, for the picker |
| `POST /api/local/*` | The VS Code extension's equivalents — local files in, no GitHub involved |

Full contract in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §6.

## 🎨 UI Components

- **`Graph` / `GraphCanvas`**: the force-directed mind map, custom canvas drawing
- **`DetailPanel`**: an idea's rationale, files, diff, and every action (Build, Expand, Open PR, Reject)
- **`DecisionsLog`**: every rejected idea, who rejected it, and why
- **`BuildSelectedPanel`**: Ctrl/Cmd-click several ideas, build them all in one go
- **`ActivityFeed`**: the map's event history, newest first

## 🚨 Troubleshooting

### Common Issues

1. **"MongoDB connection failed: Server selection timed out"**
   - Your IP usually isn't on the Atlas allow list. In Atlas → your cluster → **Connect**, add your current IP (or allow `0.0.0.0/0` for a hackathon)

2. **"Gemini rejected the API key"**
   - `GEMINI_API_KEY` is invalid or expired — create a new one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and restart the dev server

3. **Every repo shows the same sample map**
   - `MOCK_MODE=true` — set it to `false` in `.env.local` for real repos

4. **"redirect_uri is not associated with this application"**
   - Your OAuth App's callback URL doesn't exactly match where you're running the app (port, host, http vs https) — make a separate OAuth App per environment

5. **"GitHub sign-in isn't set up on this server yet"**
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `SESSION_SECRET` aren't all set — the home page names exactly which one is missing

### Environment Variables
```bash
# Required for real mode
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest
MONGODB_URI=your_mongodb_connection_string
MOCK_MODE=false

# Optional
GEMINI_FALLBACK_MODEL=      # used when the main model is overloaded
GITHUB_TOKEN=                # shared service token; not needed once sign-in is set up
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes — `npm run build` must pass
4. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4 for file ownership and [`docs/index.md`](docs/index.md) for where everything lives
5. Submit a pull request

## 📝 License
Built for a hackathon — no license file yet.

## 🎉 Team
Built with ❤️ for ShellHacks 2026.

---

**Docs**: start at [`docs/index.md`](docs/index.md) — it says where every kind of information lives. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the full technical spec; [`docs/CONTEXT.md`](docs/CONTEXT.md) is the why.
