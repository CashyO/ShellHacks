# Spitball

**What should I build next?** Every developer asks it. Spitball answers it for your repo.

Point Spitball at a GitHub repo (or open a local project in VS Code) and it reads your code and turns it into a mind map of ideas: features, fixes, tests, security holes. Each one points at the actual file or function it's about. Then it keeps up with you. Push a commit and the map notices what you built, turns those ideas green, and sprouts the next ones. Like an idea? Click it and Spitball writes the code and opens the pull request.

Try it live: **<https://shellhacks-projectgraph-qrx89.ondigitalocean.app>**

## Why not just ask Claude Code or Copilot?

Honestly, for "fix this one thing right now," a chat tool is the better choice: it's more flexible and you never leave your editor. We use them too.

What a chat session can't do is *remember*. It doesn't know what your team already tried, what you decided against and why, or what shipped last week. Spitball keeps that. Reject an idea and say why, and every teammate sees that decision from then on. Merge a PR and its bubble turns green on its own. Push something by hand and Spitball figures out what you built. Nobody has to keep the backlog up to date, because the map updates itself.

## What it does

- **Reads your code, not a template.** Every idea has to cite a real file or function in your repo. Gemini returns structured output, and we validate it with zod before it's saved, so made-up paths get thrown out.
- **Follows your team's rules.** If you have an `ARCHITECTURE.md`, `CONTRIBUTING.md` or ADRs, Spitball reads them and treats them as binding.
- **Builds the idea.** Gemini writes the full new file contents, the server computes the diff, you look it over, and then it opens a real pull request.
- **Grows with your commits.** A merged PR turns its bubble green. A commit you wrote yourself gets detected as new work, and follow-up ideas sprout from it.
- **Signs you in with GitHub.** You pick from your own repos (private ones included), and PRs open under your name.
- **Lets you plan by hand, too.** Add your own ideas, Ctrl/Cmd-click a few and build them together, or reject one with a reason.
- **Keeps a decisions log.** Every rejected idea, who rejected it and why, in one place.
- **Has a VS Code extension.** A quiet agent watches what you're working on, pitches ideas when you pause, and can build a change and apply it to your files. It works on local repos, no GitHub needed.
- **Caches AI answers** in Mongo, so the same question gets the same answer instantly (handy during a live demo).

## How it's built

It's a single Next.js app (App Router): the API routes are the backend, and there's one thing to deploy.

- **AI:** Gemini through `@google/genai`, with JSON-schema structured output. Every response goes through zod before it touches the database.
- **Data:** MongoDB Atlas holds the maps and the AI response cache.
- **GitHub:** Octokit for reading repos, committing and opening PRs. Sign-in is hand-rolled OAuth with an AES-GCM encrypted session cookie, no auth library.
- **Frontend:** React 19, TypeScript and Tailwind. The map is `react-force-graph-2d` with our own canvas drawing.
- **VS Code extension:** plain `vscode` API, no bundler. It reads your local git checkout and talks to the same API.

## Running it yourself

You'll need Node.js 20+. For real repos you'll also want a [Gemini API key](https://aistudio.google.com/apikey) and a MongoDB Atlas cluster (the free tier is plenty). If you just want to click around the UI, you can skip both for now.

```bash
git clone https://github.com/CashyO/SpitBall-ShellHacks.git
cd ShellHacks
npm install
cp .env.example .env.local
npm run dev
```

Then open <http://localhost:3000>.

Out of the box `.env.local` has `MOCK_MODE=true`, which runs with **no keys at all** and shows a sample map. When you're ready for real repos, set `GEMINI_API_KEY`, `GEMINI_MODEL`, `MONGODB_URI` and `MOCK_MODE=false`. `.env.example` explains every variable, and `docs/ARCHITECTURE.md` §9 has the details.

### GitHub sign-in (optional)

1. Create an OAuth App at [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**, with the callback URL `http://localhost:3000/api/auth/callback`.
2. Add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `SESSION_SECRET` (32+ characters) to `.env.local`.
3. Restart the dev server. A **Connect GitHub** button shows up on the home page.

### The VS Code extension (optional)

Grab the latest `.vsix` from [Releases](https://github.com/CashyO/SpitBall-ShellHacks/releases/latest) and install it with **Extensions: Install from VSIX…** in VS Code, or from a terminal:

```bash
code --install-extension spitball-<version>.vsix
```

It talks to the live site by default, so you don't need to run anything. To point it at your own copy, run `npm run dev` and set `spitball.url` to `http://localhost:3000`. More in [`vscode-extension/README.md`](vscode-extension/README.md).

## Using it

1. Open the app (the live site, or `npm run dev` on port 3000).
2. Connect GitHub and pick a repo, or hit **Try demo** to look around first.
3. Click any bubble to see *why* it fits your code. From there you can expand it into smaller ideas, build it, or reject it with a reason.
4. Build an idea, check the diff, and click **Open PR**. Merge it on GitHub, then watch the bubble turn green and new ideas sprout from it.

No repo handy? Try `https://github.com/expressjs/cors`, or any public repo (or your own, once you're signed in).

## API

| Route | What it does |
|---|---|
| `POST /api/analyze` | Snapshots a repo, asks Gemini for ideas, saves a new map |
| `GET /api/maps/[id]` | Loads a map |
| `PATCH /api/maps/[id]` | Changes a node's status (for example, reject it with a reason) |
| `POST /api/nodes` | Adds an idea by hand |
| `POST /api/expand` | Generates 3–5 follow-up ideas for a node |
| `POST /api/build` | Gemini writes the change; the server computes the diff |
| `POST /api/pr` | Opens a real GitHub PR from the stored proposal |
| `POST /api/sync` | Checks new commits: marks ideas shipped, detects new work, sprouts ideas |
| `GET /api/repos` | Lists the signed-in user's repos for the picker |
| `POST /api/local/*` | The VS Code extension's versions of these: local files in, no GitHub involved |

The full contract is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §6.

## Where things live in the UI

- **`Graph` / `GraphCanvas`**: the mind map itself, force-directed, drawn on a canvas.
- **`DetailPanel`**: everything about one idea: its rationale, files, diff, and the buttons (Build, Expand, Open PR, Reject).
- **`DecisionsLog`**: every rejected idea, who rejected it and why.
- **`BuildSelectedPanel`**: Ctrl/Cmd-click a few ideas and build them in one go.
- **`ActivityFeed`**: what's happened on the map, newest first.

## When things go wrong

**"MongoDB connection failed: Server selection timed out"**
Your IP probably isn't on the Atlas allow list. In Atlas, open your cluster → **Connect** and add your current IP (for a hackathon, `0.0.0.0/0` is fine).

**"Gemini rejected the API key"**
The `GEMINI_API_KEY` is invalid or expired. Make a new one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and restart the dev server.

**Every repo shows the same sample map**
You're still in mock mode. Set `MOCK_MODE=false` in `.env.local`.

**"redirect_uri is not associated with this application"**
The callback URL on your OAuth App doesn't exactly match where the app is running (port, host, http vs https). Make a separate OAuth App for each environment.

**"GitHub sign-in isn't set up on this server yet"**
One of `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` or `SESSION_SECRET` is missing. The home page tells you which.

Here's everything `.env.local` can hold:

```bash
# Needed for real repos
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest
MONGODB_URI=your_mongodb_connection_string
MOCK_MODE=false

# Optional
GEMINI_FALLBACK_MODEL=      # used when the main model is overloaded
GITHUB_TOKEN=               # shared service token; not needed once sign-in is set up
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
```

## Contributing

We'd love the help. Fork the repo, make a branch (`git checkout -b your-feature`), and make sure `npm run build` passes before you open a PR. Before you start, check [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4 to see who owns which files, and [`docs/index.md`](docs/index.md) for where everything lives.

## License

We built this at a hackathon and haven't picked a license yet.

## Who made it

Our team built Spitball at ShellHacks 2026, mostly on too little sleep.

---

**Want to dig deeper?** Start with [`docs/index.md`](docs/index.md), which points to where everything is. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the full technical spec, and [`docs/CONTEXT.md`](docs/CONTEXT.md) covers why we built it the way we did.
