# ProjectGraph — Build Plan

Hackathon clock: started **Fri 11 PM** (H0). Plan written at **Sat 9 AM (H10)**.
**MVP frozen Sat 11 PM (H24).** Then polish, sleep, demo, submit. Submission deadline **Sun 11 AM**. Submit by **10 AM**.

Tick boxes as you finish them. Each phase has an **exit check**; don't start the next phase's integration until it passes.

## Team and roles

| Who | Strength | Role | Owns (files) |
|---|---|---|---|
| **Joeco** | UI/UX | **P1 Graph + look and feel** | `Graph.tsx`, `Legend.tsx`, `map/[id]/page.tsx` (layout), `page.tsx` (landing), `Header.tsx`, `globals.css` / Tailwind styling |
| **Julian** | Python, learning frontend | **P2 Panels** | `DetailPanel.tsx`, `DiffView.tsx`, `ActivityFeed.tsx` |
| **Sebastian** | Integration | **P4 GitHub + DB + wiring** | `github.ts`, `db.ts`, `api-client.ts`, routes `maps`, `pr`, `sync`, DO deploy, wiring polling and state into the map page |
| **Josiah** | Architecture, ideas | **P3 AI + lead** | `types.ts`, `schemas.ts`, `prompts.ts`, `gemini.ts`, `mock.ts`, routes `analyze`, `expand`, `build`, demo repo, review/merge, demo script, Devpost |

Why this split: everyone starts **unblocked**. The frontend pair builds against the mock API that already works (`MOCK_MODE=true`). The backend pair builds against the shared types. Nobody waits on anyone until integration.

**Julian's on-ramp:** his panels are plain React components that take a `node` or `map` prop and render it. The prototype (`docs/prototype.html`) shows exactly what each looks like, and Joeco's styling makes them pretty. He can copy patterns from Joeco's first component.

## Working alone (rules for everyone)

1. **Base:** Josiah merges `josiah` into `main` first (see Phase 0). Everyone branches from `main`: `joeco/graph`, `julian/panels`, `sebastian/github-db`.
2. **Mock first:** `MOCK_MODE=true` in `.env.local`. `GET /api/maps/demo` returns a full map, and expand/build/pr/sync all work in memory. Build your piece against that before touching real keys.
3. **Stay in your files.** Need a change in someone else's file? Post it in team chat.
4. **`types.ts` is the contract.** Never edit it alone.
5. **Small PRs** into `main`, at least every 2 hours. `npm run build` must pass before you merge. Get a thumbs up from anyone awake; if only your pair is awake, approve each other.
6. **Coding agents:** start every session with "read CLAUDE.md and docs/". Give the agent **one task from this file at a time**.
7. **Blocked more than 30 minutes?** Post in chat right away. Don't sit on it.
8. **Before you sleep:** post a handoff note: what's done, what's next, your branch name, and anything broken. Set two alarms.

## Sleep shifts (two awake at all times until 6 PM)

| Shift | Who | Sleeps | Why then |
|---|---|---|---|
| A | **Joeco + Julian** | **Sat 10:00 AM – 1:30 PM** | Their work is mock-driven, so nothing blocks them later. They wake up to a finished backend to integrate with. |
| B | **Josiah + Sebastian** | **Sat 2:30 PM – 6:00 PM** | Backend routes are done by 2:30, and the frontend pair spends this window on UI against real routes. |
| All | everyone | **Sun 2:00 AM – 7:00 AM** | After the freeze and polish. Code written tired costs the demo. |

**1:30 – 2:30 PM is the handoff hour: all four awake.** Flip `MOCK_MODE=false` and agree on what Joeco and Julian build while Josiah and Sebastian sleep.

---

## Phase 0: Foundation · Sat 9:00–10:00 AM · everyone together

- [x] Next.js app scaffolded (`create-next-app`, TypeScript, Tailwind, App Router, `src/`)
- [x] ARCHITECTURE §2 dependencies installed
- [x] Josiah: `src/lib/types.ts` exactly as ARCHITECTURE §5
- [x] Josiah: `src/lib/mock.ts` 12-node `CodeMap` and in-memory store
- [x] Josiah: `MOCK_MODE` → every API route works in memory
- [x] Josiah: `gemini.ts` `generateJSON()`, `schemas.ts`, `prompts.ts` (untested against a real key)
- [x] **Josiah: open a PR `josiah` → `main` and merge it** so everyone starts from the same base
- [ ] **Sebastian: accounts and keys** — Gemini key (AI Studio) + model id, MongoDB Atlas free cluster + URI (Network Access `0.0.0.0/0`), GitHub PAT (`repo` scope), DigitalOcean app connected to the repo. Share keys privately, never in the repo.
- [x] Sebastian: add teammates as collaborators
- [x] Everyone: `git pull`, `npm install`, `cp .env.example .env.local`, `npm run dev`, and open `http://localhost:3000/api/maps/demo`
- [ ] Sebastian: deploy the hello-world build to DigitalOcean App Platform

**Exit check:** every laptop runs the app. `/api/maps/demo` returns the mock map. The DO URL loads.

## Phase 1: Build in parallel · Sat 10 AM–2:30 PM

### Joeco (P1) — asleep 10:00–1:30, so he starts here at 1:30
- [ ] `Graph.tsx` renders `GET /api/maps/demo` with react-force-graph-2d (`dynamic(..., { ssr: false })`). *Done when:* 12 nodes and a root appear.
- [ ] Synthetic root node; links for `parentId === null`
- [ ] Custom drawing per ARCHITECTURE §8: color by type, size by effort, dashed / pulsing / solid / green by status, labels
- [ ] Click a node → `onSelect(nodeId)`; clicking the background selects the root
- [ ] `Legend.tsx`; root progress ring (shipped / total)
- [ ] Landing page look (`page.tsx`) and `Header.tsx`; global styling tokens the panels reuse

### Julian (P2) — asleep 10:00–1:30, so he starts here at 1:30
- [ ] `DiffView.tsx`: takes a unified-diff string; + green, − red, `@@` blue. *Done when:* it renders the mock proposal's diff. **Easiest first task; learn React here.**
- [ ] `ActivityFeed.tsx`: renders `map.events` newest first with an icon per `kind`
- [ ] `DetailPanel.tsx` for every status (ARCHITECTURE §8): suggested (Build it · Expand · Copy prompt), building (spinner), proposal (DiffView + Open PR / Discard), pr_open (link · Expand), shipped (sha · Expand). Buttons can call handler props that do nothing yet.

### Sebastian (P4) — awake 9–2:30
- [ ] `db.ts`: cached Mongo client, `getMap`, `saveMap`, `updateMap`, plus the `ai_cache` helpers (then move `gemini.ts`'s in-memory cache onto them with Josiah)
- [ ] `github.ts`: `parseRepoUrl`, `getSnapshot` (filters and caps from ARCHITECTURE §6). Import the `Snapshot` type from `prompts.ts`. **Auth-ready:** every function takes an optional `token` (default `process.env.GITHUB_TOKEN`); routes get it through one `getRequestToken(req)` helper; add `getRepoAccess()` returning `{ canWrite }` (ARCHITECTURE §6 "Auth-ready design").
- [ ] Sebastian + Julian: when `canWrite` is false, `DetailPanel` disables "Open PR" and shows "Preview only: PRs need write access"
- [ ] `GET` / `PATCH /api/maps/[id]` against Mongo (keep the `MOCK_MODE` branch)
- [ ] `api-client.ts`: typed wrappers for every §6 route so the UI never calls `fetch` directly. **Do this early, since both frontend devs use it.**
- [ ] Standalone PR test script: create a branch, commit 1 file, open a PR on the demo repo
- [ ] `POST /api/pr` using the stored proposal (§6 "pr")
- [ ] `POST /api/sync`, deterministic part only: `Merge pull request #N` → node `shipped`

### Josiah (P3) — awake 9–2:30
- [ ] **Demo repo** (`chronos-scheduler`, ~10 files) in its own repo; PAT has write access
- [ ] `/api/analyze` real path, using a local JSON snapshot until Sebastian's `getSnapshot` lands
- [ ] Tune `prompts.analyze` on the demo repo until ideas are **specific and cite files**. This is the moat.
- [ ] `prompts.expand` + `/api/expand`
- [ ] `prompts.build` + `/api/build` (full file contents → server diff via `createTwoFilesPatch` → `node.proposal`)
- [ ] Move the AI cache into Mongo with Sebastian

**Exit check (2:30 PM):** analyzing the demo repo saves a map to Mongo; `GET /api/maps/:id` returns it; graph and panels render the mock map; the PR test script opens a real PR.

## Phase 2: Integrate + Build/PR · Sat 1:30–6:00 PM · Joeco + Julian awake, Josiah + Sebastian asleep 2:30–6

Handoff hour (1:30–2:30, all awake): flip `MOCK_MODE=false`, confirm routes, read each other's handoff notes.

- [ ] Joeco: map page state: one `map` object, every API response → `setMap`; merge incoming nodes into existing objects by id (keep `x/y`); new nodes spawn at their parent
- [ ] Joeco + Julian: wire `DetailPanel` handlers through `api-client.ts`: Expand, Build, Open PR, Discard
- [ ] Julian: build flow UI: Build it → spinner → DiffView → Open PR → PR link
- [ ] Joeco: landing → `POST /api/analyze` → redirect to `/map/[id]`, with rotating loading lines ("Reading file tree…", "Finding ideas…")
- [ ] Julian: error states: bad URL, private repo, Gemini failure show a readable message, never a blank screen

**Exit check (6 PM, all awake):** on the deployed site, click a node on the demo repo, see a diff, and get a **real PR on GitHub**.

## Phase 3: Sync loop · Sat 6:00–9:00 PM · all awake

- [ ] Josiah: `prompts.sync` + validation (ids exist, `detected`, `sprouts`)
- [ ] Sebastian: wire the AI part into `/api/sync`, update `lastSyncedSha`, push events
- [ ] Joeco: poll `/api/sync` every 20 s (pause during in-flight build/PR); animate shipped (green) and sprouted nodes; progress ring
- [ ] Julian: activity feed shows commit / ship / sprout / detect events nicely
- [ ] Joeco: header shows "Watching main · synced <sha>"

**Exit check:** merge the PR on GitHub → within 30 s the node turns green and 2–3 ideas sprout. Push a hand-written commit → a "detected" node appears.

## Phase 4: Harden · Sat 9:00–11:00 PM

- [ ] Josiah: AI cache on; pre-run analyze/expand/build for the demo repo so the demo runs from cache
- [ ] Sebastian: production deploy on the GoDaddy domain; env vars set on DO
- [ ] All: full run-through of the demo script **twice on the deployed site**

### 🔒 MVP FREEZE Sat 11 PM. After this, only bug fixes and polish on `main`.

## Phase 5: Polish, sleep, ship

- [ ] **11 PM–1:30 AM:** polish visuals (Joeco leads). At most **one** stretch item, only if the run-through passed, **in this priority order**:
  - [ ] **GitHub OAuth login** (Sebastian): "Sign in with GitHub"; the user's token replaces the service token via `getRequestToken`; maps get an owner. Needs a §2 dependency decision and an OAuth app with callbacks for localhost and the deployed domain. Skip it if the run-through hasn't passed twice.
  - [ ] "Sync now" button
  - [ ] Filter by type / hide shipped
  - [ ] Create GitHub issue from a node
- [ ] **2 AM–7 AM: everyone sleeps.**
- [ ] **7–8 AM:** final run-through; record a **backup demo video** of the full loop
- [ ] **8–9 AM:** Devpost write-up, screenshots, list tracks (Microsoft, Gemini, MongoDB, DigitalOcean, GoDaddy) (Josiah + Sebastian)
- [ ] **9–10 AM: submit.** Rehearse the pitch 3× (Josiah pitches, Joeco drives the demo).

---

## Fallback rules (decide fast, don't argue)

| If at… | this isn't working | do this |
|---|---|---|
| Sat 2:30 PM | Real analyze on the demo repo | Demo from a hand-tuned cached analysis; keep the real route for other repos |
| Sat 6:00 PM | Real PR creation | Build shows the diff + "Copy prompt" + "Create issue"; PR becomes the stretch goal |
| Sat 9:00 PM | AI part of sync | Keep deterministic PR-merge detection only (merge → green); sprout via Expand |
| Sat 9:00 PM | Polling | "Sync now" button calling the same route |
| Any | Someone is blocked > 30 min | Post in chat immediately; the lead pairs with them |
| Any | Wifi / Gemini down on stage | `MOCK_MODE=true` demo, or play the backup video |

## Demo script (≈3 min)

1. The problem: vibe coders keep asking the AI "what next?" and lose ideas in chat history.
2. Paste the demo repo; the map blooms. Point at an idea that names a real file.
3. Expand "Pomodoro timer" → children sprout.
4. Build "Validate POST /events" (security) → diff → Open PR → show the real PR on GitHub.
5. Merge on GitHub → back in the app the node turns green and new ideas sprout.
6. A teammate pushes a hand-written commit → the map detects it and grows from it.
7. Close: "Your codebase becomes a map you steer, not a chat you type into."
