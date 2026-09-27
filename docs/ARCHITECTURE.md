# ProjectGraph — Architecture

> Working name. Rename freely; keep this file the source of truth.
> Every human and every coding agent reads this before writing code.

## 1. What we're building (one paragraph)

ProjectGraph turns a GitHub repo into a living mind map of what to build next. The center node is the codebase. Gemini reads the code and grows idea nodes (features, improvements, fixes, security, tests), each grounded in real files. Clicking a node can **Expand** it (child ideas), or **Build** it (Gemini writes the change → diff preview → user confirms → a real GitHub PR opens). The app polls the repo; when new commits land, Gemini reads the diff, marks built ideas **shipped** (green), and **sprouts** new ideas from what was just written.

**The core loop (this is the demo):**
`push code → map grows → click bubble → PR opens → merge → bubble turns green → new ideas sprout`

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One repo, one deploy. API routes = backend. |
| Styling | Tailwind CSS | |
| Graph | **react-force-graph-2d** | Canvas-based. Must be loaded with `dynamic(..., { ssr: false })`. |
| Diff rendering | `diff` npm package (`createTwoFilesPatch`) | Server generates unified diff; client just colors lines. |
| AI | **Gemini API** via `@google/genai` | Model name in `GEMINI_MODEL` env var (use the current Flash model from AI Studio). JSON mode + response schema. |
| Validation | `zod` | Every AI response is validated before it touches the DB. |
| GitHub | `@octokit/rest` | MVP: one service token from `GITHUB_TOKEN`, server-side only. Every `github.ts` function takes an optional `token` argument (see §6 "Auth-ready design"). |
| Database | **MongoDB Atlas** via official `mongodb` driver | No Mongoose. One main collection. |
| Hosting | **DigitalOcean App Platform** | Auto-deploys from `main`. |
| Domain | GoDaddy domain → DO app | |

**Do not add other dependencies** without writing them into this table first.

## 3. System diagram

```
┌────────────────────────── Browser ───────────────────────────┐
│  /               Landing: paste repo URL / "Try demo"         │
│  /map/[id]       Graph + DetailPanel + ActivityFeed          │
│                  polls POST /api/sync every 20s              │
└───────────────┬──────────────────────────────────────────────┘
                │ fetch (src/lib/api-client.ts)
┌───────────────▼────────────── Next.js API routes ────────────┐
│ /api/analyze  /api/maps/[id]  /api/expand  /api/build        │
│ /api/pr       /api/sync                                      │
└──────┬──────────────────┬───────────────────┬────────────────┘
       │                  │                   │
  src/lib/github.ts  src/lib/gemini.ts    src/lib/db.ts
  (Octokit)          (+ prompts.ts,        (MongoDB Atlas:
       │              schemas.ts, cache)    maps, ai_cache)
       ▼                  ▼
    GitHub            Gemini API
```

## 4. Folder structure & ownership

Each file has **one owner**. Only the owner edits it. Others open a request in team chat.

```
projectgraph/
├─ CLAUDE.md                      all (rules for agents)
├─ docs/ARCHITECTURE.md           lead only
├─ docs/PLAN.md                   everyone ticks own boxes
├─ .env.example                   P4
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                 P1  landing page
│  │  ├─ map/[id]/page.tsx        P1  map page (layout: graph + panels)
│  │  └─ api/
│  │     ├─ analyze/route.ts      P3
│  │     ├─ maps/[id]/route.ts    P4  GET map, PATCH node status
│  │     ├─ expand/route.ts       P3
│  │     ├─ build/route.ts        P3
│  │     ├─ pr/route.ts           P4
│  │     └─ sync/route.ts         P4 (commit fetching) + P3 (AI part via lib)
│  ├─ components/
│  │  ├─ Graph.tsx                P1
│  │  ├─ Legend.tsx               P1
│  │  ├─ DetailPanel.tsx          P2
│  │  ├─ DiffView.tsx             P2
│  │  ├─ ActivityFeed.tsx         P2
│  │  └─ Header.tsx               P1
│  └─ lib/
│     ├─ types.ts                 P3  ★ SHARED CONTRACT — change only with team OK
│     ├─ schemas.ts               P3  zod + Gemini response schemas
│     ├─ prompts.ts               P3
│     ├─ gemini.ts                P3  generateJSON() + ai_cache
│     ├─ github.ts                P4
│     ├─ db.ts                    P4
│     ├─ mock.ts                  P3  fixture map for MOCK_MODE
│     └─ api-client.ts            P4  typed fetch wrappers used by all UI
```

## 5. Shared types (`src/lib/types.ts`) — the contract

Create this file exactly in Phase 0. Frontend and backend both build against it.

```ts
export type NodeType = "feature" | "improvement" | "fix" | "security" | "test";
export type NodeStatus = "suggested" | "building" | "pr_open" | "shipped" | "rejected";
export type Effort = "S" | "M" | "L";

/** What Gemini returns for one idea (no ids, no status). */
export interface IdeaDraft {
  title: string;        // ≤ 5 words
  description: string;  // 1–2 sentences, user-facing
  rationale: string;    // "why this fits your code" — must cite a real file/function
  type: NodeType;
  effort: Effort;
  files: string[];      // paths that exist in the repo, or new paths ending in a real dir
}

export interface IdeaNode extends IdeaDraft {
  id: string;                 // nanoid
  parentId: string | null;    // null = attached to the root (codebase) node
  status: NodeStatus;
  origin: "analyze" | "expand" | "sync" | "detected" | "manual";
  createdAt: string;          // ISO
  createdBy?: string;         // GitHub login, for manually-added ideas
  dependsOn?: string[];       // ids of other nodes that should ship first (advisory, not enforced)
  rejectedBy?: string;        // GitHub login who rejected it, if signed in
  rejectedNote?: string;      // why, for teammates who see it later
  proposal?: Proposal;        // set by /api/build
  pr?: { number: number; url: string; branch: string };
  shippedCommit?: string;     // sha
}

export interface FileChange { path: string; newContent: string; isNew: boolean }

export interface Proposal {
  changes: FileChange[];      // max 3 files
  diff: string;               // unified diff, generated server-side
  prTitle: string;
  prBody: string;
  createdAt: string;
}

export interface MapEvent {
  at: string;
  kind: "analyze" | "expand" | "build" | "pr" | "commit" | "ship" | "sprout" | "detect" | "error" | "create" | "reject" | "link";
  text: string;               // human-readable line for the activity feed
  nodeId?: string;
  sha?: string;
}

export interface CodeMap {
  _id: string;
  repo: { owner: string; name: string; defaultBranch: string; url: string };
  summary: string;            // 1–2 sentences: what this app is
  stack: string[];            // e.g. ["React", "Express"]
  lastSyncedSha: string;
  nodes: IdeaNode[];          // root node is NOT stored; UI draws it from `repo`
  events: MapEvent[];         // newest last
  createdAt: string;
  updatedAt: string;
}
```

**Graph rendering rule:** the UI creates a synthetic root node `{ id: "root" }` and links every node with `parentId === null` to it.

## 6. API contract

All routes: JSON in, JSON out. Errors return `{ error: string }` with a 4xx/5xx status. Every route that changes the map returns the **full updated `CodeMap`**, so the frontend just replaces its state (simple and consistent).

| Method & path | Body | Returns | Does |
|---|---|---|---|
| `POST /api/analyze` | `{ repoUrl }` | `{ map: CodeMap }` | Snapshot repo → Gemini analyze → save new map with 8–12 nodes |
| `GET /api/maps/[id]` | – | `{ map: CodeMap }` | Load map |
| `PATCH /api/maps/[id]` | `{ nodeId, status?, note?, dependsOn? }` | `{ map }` | `status` = manual status change; on `status: "rejected"`, `note` (optional) is recorded with the signed-in user's login as `rejectedBy`/`rejectedNote` and logged as a `reject` event. `dependsOn` (optional) replaces the node's full dependency list (ids of other nodes it should ship after), logged as a `link` event. Either or both may be sent in one call. |
| `POST /api/nodes` | `{ mapId, title, type, effort, description?, rationale?, files?, parentId? }` | `{ map }` | Manually add an idea (steer the map yourself, not just accept AI suggestions). `origin: "manual"`, `status: "suggested"`; `createdBy` set from the signed-in user if any. Logged as a `create` event. |
| `POST /api/expand` | `{ mapId, nodeId }` | `{ map }` | Gemini generates 3–5 children for node |
| `POST /api/build` | `{ mapId, nodeId }` | `{ map }` | Fetch node's files fresh → Gemini writes full new file contents → server builds diff → store `node.proposal` |
| `POST /api/pr` | `{ mapId, nodeId }` | `{ map }` | Uses stored proposal → branch `projectgraph/<nodeId>` → commit files → open PR → `status = "pr_open"` |
| `POST /api/sync` | `{ mapId }` | `{ map, changed: boolean }` | Compare `lastSyncedSha...defaultBranch`. If new commits: mark shipped, detect new work, sprout ideas |

### Manual planning (built)

Not every idea has to come from Gemini, and not every ordering decision should wait for it to notice a relationship.
`IdeaNode` carries `dependsOn?: string[]` (ids of nodes that should ship first — advisory, not enforced) and
`createdBy?` / `rejectedBy?` / `rejectedNote?` for who did what. The graph (`GraphCanvas.tsx`) draws dependency
edges as a thin dashed amber line with a small arrowhead pointing at the prerequisite, separate from the solid
parent/child tree links — static, no hover animation (a "shares files" hover effect was removed for being
distracting; don't reintroduce that pattern here). `DetailPanel.tsx` has the "＋ Add idea" form and the "Depends
on" add/remove UI. Every node's activity-feed events (`create`, `reject`, `link`, plus the existing kinds) are
also shown filtered to that node as a small "History" section in the panel — the provenance of a decision without
scrolling the whole feed.

### GitHub sign-in and token handling (built)

Without sign-in, the app uses one service token (`GITHUB_TOKEN`): it can read any public repo but write only where that account has push access. With GitHub sign-in (below), each user's own token is used instead, so PRs open as them, on their repos, including private ones. The rules that keep both working:

- **Every function in `github.ts` takes a `token` argument** (`getSnapshot(owner, name, token?)`, `createPr(..., token?)`, etc.) and defaults to `process.env.GITHUB_TOKEN`. Never read the env var anywhere else.
- **Routes obtain the token through one helper** (for example `getRequestToken(req)` in `github.ts`). It returns the signed-in user's token from the encrypted cookie, else the env token. Routes never touch tokens directly.
- **Write-permission check:** `github.getRepoAccess(owner, name, token?)` returns `{ canWrite: boolean }` (from the repo's `permissions.push`). If `canWrite` is false, the UI shows the diff and "Copy prompt" and disables "Open PR" with the note "Preview only: PRs need write access". This is the same graceful fallback as PLAN.md's fallback table.
- **Built: GitHub OAuth.** `GET /api/auth/login` sends the user to GitHub (scope `repo`); `GET /api/auth/callback` exchanges the code and stores the token in an AES-GCM encrypted, httpOnly cookie (`src/lib/session.ts`, key from `SESSION_SECRET`). `getRequestToken(req)` returns the user's token, else `GITHUB_TOKEN`. `GET /api/auth/me` (never returns the token), `POST /api/auth/logout`, and `GET /api/repos` (the signed-in user's repos for the picker) support the landing page. Uses plain `fetch`, no new dependency. Map ids are UUIDs, so a map link is the only thing protecting a private repo's map.

### Route internals

**analyze**
1. `github.parseRepoUrl(url)` → owner/name.
2. `github.getSnapshot(owner, name)` → `{ defaultBranch, headSha, tree: string[], files: {path, content}[] }`.
   - Skip: `node_modules/ dist/ build/ .next/ coverage/`, lockfiles, images/binaries, files > 100 KB.
   - Always include README, package.json (or requirements.txt etc.), then source files, max **40 files / ~200 KB**.
3. `gemini.generateJSON(prompts.analyze(snapshot), AnalyzeSchema)` → `{ summary, stack, ideas: IdeaDraft[] }`.
4. **Post-filter:** drop any idea whose `files` reference a path not in the tree (unless it is clearly a new file in an existing folder). Keep 8–12.
5. Save the map with `lastSyncedSha = headSha` and an `analyze` event.

**expand:** prompt includes repo summary, tree, parent node, and the **titles of all existing nodes** (so no duplicates). Returns 3–5 drafts → `origin: "expand"`.

**build**
- Fetch current contents of `node.files` from GitHub (fresh, not from the snapshot).
- Gemini returns **full new file contents** (never patches, since models write broken patches), plus prTitle and prBody. Max 3 files.
- Server computes the unified diff with `createTwoFilesPatch` and stores the proposal. Set `status: "building"` while running and revert to `"suggested"` on failure.

**pr** (Octokit, contents API, no git trees needed)
1. `git.getRef heads/<defaultBranch>` → base sha.
2. `git.createRef refs/heads/projectgraph/<nodeId>`.
3. For each change: `repos.createOrUpdateFileContents` on that branch (pass existing file `sha` when updating).
4. `pulls.create` → save `{ number, url, branch }`, `status: "pr_open"`, event `pr`.

**sync** (the frontend calls it every 20 s while the map page is open)
1. `repos.compareCommitsWithBasehead(lastSyncedSha...defaultBranch)`. If there are 0 commits, return `{ changed: false }`. **No Gemini call.**
2. **Deterministic first:** any commit message containing `Merge pull request #N` where a node has `pr.number === N` → that node is `shipped`. No AI needed.
3. Then one Gemini call with: commit messages, file patches (truncated to ~30 KB), and open nodes (`id, title, files`). It returns:
   `{ shippedIds: string[], detected: IdeaDraft | null, sprouts: { parentId: string, idea: IdeaDraft }[] }`
   - `detected` = a feature the user built themselves that has no node. Add it as `status: "shipped", origin: "detected"`.
   - `sprouts` = 2–3 new ideas hanging off whatever was just shipped or detected.
4. Validate that every returned id exists. Update `lastSyncedSha` and push events.

## 7. Gemini usage (`src/lib/gemini.ts`)

```ts
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateJSON<T>(prompt: string, responseSchema: object, zodSchema: ZodType<T>): Promise<T> {
  // 1. check ai_cache by sha256(model + prompt) → return if hit
  // 2. ai.models.generateContent({ model: process.env.GEMINI_MODEL, contents: prompt,
  //      config: { responseMimeType: "application/json", responseSchema } })
  // 3. zodSchema.parse(JSON.parse(res.text)); on failure retry ONCE with the error appended
  // 4. write to ai_cache, return
}
```

**Prompt rules (non-negotiable; this is what makes the demo impressive):**
- Every idea's `rationale` must name a real file or function from the provided code.
- Only reference files from the provided tree.
- Never suggest something the code already does.
- Banned unless the code specifically justifies it: dark mode, login/auth, generic "add tests," "improve UI," "add comments," "refactor."
- Mix of types: at least 1 security or fix when there is a real reason.
- Titles ≤ 5 words, descriptions ≤ 2 sentences.

**AI cache** (`ai_cache` collection, `{ _id: hash, response, createdAt }`): the same prompt returns the same answer instantly. It makes the demo fast and deterministic. Set `AI_CACHE=off` to disable it while tuning prompts.

**Convention grounding (built):** if the repo has an `ARCHITECTURE.md`, `CONTRIBUTING.md`, `DESIGN.md`, or an `ADR`-style file/folder, its content is pulled out as a separate `PROJECT CONVENTIONS` block in the analyze, expand, and build prompts (`prompts.isConventionDoc` / `renderConventions`) — treated as binding, so an idea that conflicts with a team's own documented rules gets dropped or explicitly flagged instead of silently suggested anyway. `analyze` gets these for free (the file-picker in `github.ts` scores them just under README). `expand` looks them up from the already-fetched tree. `build` speculatively fetches a short list of common filenames in parallel with everything else, so it costs no extra round trip when they don't exist.

## 7a. Decisions log (built)

`DecisionsLog.tsx`, opened from a "Decisions (n)" button in the header, lists every **rejected** idea with who rejected it and why (`rejectedBy` / `rejectedNote`, set by `PATCH /api/maps/[id]`). Rejected nodes are hidden from the graph itself (§8), so this is the only place that record is visible — the point being a durable, searchable "what we already considered and said no to," which a chat session has no equivalent of.

## 8. Frontend behavior

- `/map/[id]` loads the map, renders `Graph` (left, flexible width) and `DetailPanel` + `ActivityFeed` (right, 380px).
- **State:** one `map` object in the page component. Every API call returns a new map → call `setMap`.
- **react-force-graph gotcha:** the library stores `x/y` on node objects. When a new map arrives, **merge** into the existing node objects by id (keep `x, y, vx, vy`). New nodes start at their parent's position so they visibly sprout. Don't hand it a brand-new array every poll, or the graph will jump.
- **Visual encoding:**
  - Color = type: feature `#2E6BE6`, improvement `#7B4ED8`, fix `#C27C06`, security `#D23C35`, test `#0C8585`.
  - Status:
    - suggested = light fill + dashed outline
    - building = pulsing
    - pr_open = solid fill + pulsing ring
    - shipped = green `#1C9A50` with ✓
    - rejected = hidden
  - Size = effort (S 6, M 8, L 10 at graph scale).
  - The root is a plain circle labeled with the repo name (no progress ring or percentage).
- **DetailPanel actions by status:**
  - suggested: Build it · Expand · Copy prompt
  - building: spinner
  - proposal exists: DiffView + Open PR / Discard
  - pr_open: link to PR · Expand
  - shipped: commit sha · Expand
- **Polling:** `setInterval(sync, 20000)` on the map page. Pause it while a build or PR request is in flight.
- Reference prototype: the clickable HTML mock (ProjectGraph artifact) shows the intended look and interactions.

## 9. Environment variables (`.env.local`, never committed)

```
GEMINI_API_KEY=
GEMINI_MODEL=            # current Flash model id from AI Studio
GITHUB_TOKEN=            # classic PAT, `repo` scope; must have write access to the demo repo
MONGODB_URI=
MOCK_MODE=false          # true = API routes return src/lib/mock.ts, no keys needed. MUST be false in production (else every repo shows the sample demo)
GITHUB_CLIENT_ID=        # OAuth App (github.com/settings/developers); callback = <APP_URL>/api/auth/callback
GITHUB_CLIENT_SECRET=
SESSION_SECRET=          # random 32+ chars
APP_URL=                 # optional public URL
AI_CACHE=on
```

Set the same variables in DigitalOcean App Platform → Settings → Environment Variables. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (hackathon only; DO uses dynamic IPs).

## 10. Git workflow

- `main` always builds and auto-deploys. Never push broken code to `main`.
- Branch per task: `p1/graph-render`, `p3/analyze-prompt`, etc. Keep branches small and short-lived.
- Merge to `main` at least every 2 hours. Run `git pull origin main` before starting each task.
- Before merging: `npm run build` passes locally.
- No force-pushes. No committing `.env*`.
- Commit messages: `feat(graph): ...`, `fix(api): ...`, `chore: ...`.

## 11. Demo repo

A small separate repo we control (e.g. `chronos-scheduler`, ~10 files, a simple scheduling app). All demo builds run against it. Before demo day: pre-run analyze, expand, and build on the nodes we will show, so they're in `ai_cache`.

## 12. Out of scope (do not build)

Live keystroke watching, auto-merging PRs, chat UI, multi-user presence, repos bigger than ~40 relevant files.

**Sign-in is built** (see §6). Still out of scope: multi-user accounts/teams, per-map access control beyond unguessable ids, and GitHub Apps.
