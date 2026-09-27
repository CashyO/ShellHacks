# Spitball — Build Plan

Hackathon clock: started **Fri 11 PM** (H0). Plan re-cut at about **Sat 12 PM (H13)**.
**MVP target: Sat 11 PM (H24), 11 hours from the re-cut.** If the core loop isn't passing then, the freeze may slide to **2 AM at the latest**. After that, only bug fixes, no new features. Submission deadline **Sun 11 AM**. Submit by **10 AM**.

Tick boxes as you finish them. Each phase has an **exit check**; don't start the next phase's integration until it passes.

## Team and roles

| Who | Strength | Role | Owns (files) |
|---|---|---|---|
| **Joeco** | UI/UX | **P1 Graph + look and feel** | `Graph.tsx`, `GraphCanvas.tsx`, `Legend.tsx`, `map/[id]/page.tsx` (layout), `page.tsx` (landing), `Header.tsx`, `globals.css` |
| **Julian** | Python, learning frontend | **P2 Panels + demo repo + deploy** | `DetailPanel.tsx`, `DiffView.tsx`, `ActivityFeed.tsx`, the **demo repo** (`chronos-scheduler`), **DigitalOcean deploy + domain** |
| **Sebastian** | Integration | **P4 GitHub + DB + wiring** | `github.ts`, `db.ts`, `api-client.ts`, routes `maps`, `pr`, `sync`, wiring polling and state into the map page, keys and accounts |
| **Josiah** | Architecture, ideas | **P3 AI + lead** | `types.ts`, `schemas.ts`, `prompts.ts`, `gemini.ts`, `mock.ts`, routes `analyze`, `expand`, `build`, review/merge, demo script, Devpost |

Why this split: everyone starts **unblocked**. The frontend pair builds against the mock API (`MOCK_MODE=true`). The backend pair builds against the shared types. Julian's demo repo and deploy need no deep code and surface problems early. Sebastian carries the riskiest code (PR, sync), so those two jobs were moved off him.

**Julian's on-ramp:** the panels are plain React components that take a `node` or `map` prop and render it. `docs/prototype.html` shows exactly what each looks like.

## How separate work comes together

1. **Contracts, not conversations.** `types.ts` and the API shapes in ARCHITECTURE §6 are fixed. UI code only talks to `api-client.ts`. Routes only talk to `github.ts`, `db.ts`, `gemini.ts`. Nobody imports across those seams.
2. **Mock on both sides.** Every API route has a `const REAL = false` flag. While it's false, the route serves mock data **even with `MOCK_MODE=false`**. The owner flips it to `true` when the real path lands, so the team integrates one route at a time.
3. **One file per owner** so branches don't conflict. Shared files that can conflict are `package.json` and docs. Announce any new dependency in chat first.
4. **Small PRs, every ~90 minutes.** `npm run build` green, and `main` always runs. Anyone awake approves; if only your pair is awake, approve each other.
5. **Fixed checkpoints**, where everyone pulls `main` and runs the flow (see the phases).
6. **Fallbacks are pre-agreed** (table at the bottom), so nobody argues about cutting.

## Working alone (rules for everyone)

1. Branch from `main`: `joeco/graph`, `julian/panels`, `sebastian/github-db`.
2. `MOCK_MODE=true` in `.env.local`. `GET /api/maps/demo` returns a full map, and expand/build/pr/sync work in memory. Build against that before touching real keys.
3. **Stay in your files.** Need a change in someone else's file? Post it in team chat.
4. **`types.ts` is the contract.** Never edit it alone.
5. **Coding agents:** start every session with "read CLAUDE.md and docs/index.md". Give the agent **one task from this file at a time**.
6. **Blocked more than 30 minutes?** Post in chat right away.
7. **Before you sleep:** post a handoff note: what's done, what's next, your branch, and anything broken.

## Sleep

Nobody sleeps during Phases 1–2, since that's when the seams are built. Take **3-hour naps in pairs during Phase 3** if the loop is passing, staggered so two people are always awake. If Phase 2 slips, protect the **Sun 2:00–7:00 AM** block for everyone. Code written tired costs the demo.

---

## Phase 0: Foundation · done except keys and deploy

- [x] Next.js app scaffolded and merged to `main`; ARCHITECTURE §2 dependencies installed
- [x] `types.ts`, `mock.ts`, `MOCK_MODE` on every route
- [x] `gemini.ts` `generateJSON()`, `schemas.ts`, `prompts.ts` (tested against a real key, 9 valid ideas)
- [x] Runnable skeleton on `main`: landing, map page, component stubs, `api-client.ts`, README
- [x] Per-route `REAL` flag so unfinished routes fall back to mock
- [ ] **Sebastian: accounts and keys** — MongoDB Atlas cluster (Network Access `0.0.0.0/0`), GitHub PAT (`repo` scope, ideally a dedicated demo account). Gemini key and model are done (`GEMINI_MODEL=gemini-flash-latest`; pin a specific model before the demo). Share keys privately, never in the repo.
- [ ] Sebastian: add teammates as collaborators
- [ ] Everyone: `git pull`, `npm install`, `cp .env.example .env.local`, `npm run dev`, click **Try demo**
- [ ] **Julian: deploy `main` to DigitalOcean App Platform** (hello-world level; env vars set)

**Exit check:** every laptop runs the app and shows the demo map. The DO URL loads.

## Phase 1: Build in parallel · H+0 to H+4 (about 12 PM–4 PM)

### Joeco (P1)
- [x] `Graph.tsx` / `GraphCanvas.tsx`: react-force-graph-2d, synthetic root, links, custom node drawing (color by type, size by effort, dashed / pulsing / solid / green ✓ by status), click to select, background click selects root, x/y preserved across updates, new nodes spawn near their parent *(first version by Josiah; Joeco owns it from here, so tune the look)*
- [ ] Look and feel pass: spacing, node sizes, label legibility, dark mode, zoom-to-fit
- [ ] `Legend.tsx`, `Header.tsx` ("Watching main · synced <sha>"), landing page styling and loading lines ("Reading file tree…", "Finding ideas…")
- [ ] Global styling tokens the panels reuse

### Julian (P2)
- [ ] **Demo repo** (`chronos-scheduler`, ~10 files, a small React + Express scheduling app with the flaws from the mock ideas: unvalidated `POST /events`, the timezone bug, no tests). The PAT account must have write access.
- [ ] `DiffView.tsx`: + green, − red, `@@` blue. *Done when:* it renders the mock proposal's diff. **Easiest first task.**
- [ ] `ActivityFeed.tsx`: newest first, an icon per `kind`
- [ ] `DetailPanel.tsx` for every status (ARCHITECTURE §8): suggested (Build it · Expand · Copy prompt), building (spinner), proposal (DiffView + Open PR / Discard), pr_open (link · Expand), shipped (sha · Expand). Handlers call `api-client.ts` and pass the new map to `onMapChange`.
- [ ] When `canWrite` is false, disable "Open PR" and show "Preview only: PRs need write access"

### Sebastian (P4)
- [ ] `db.ts`: cached Mongo client, `getMap`, `saveMap`, `updateMap`, and `ai_cache` helpers (then move `gemini.ts`'s in-memory cache onto them with Josiah)
- [ ] `github.ts`: `parseRepoUrl`, `getSnapshot` (filters and caps from ARCHITECTURE §6). Import the `Snapshot` type from `prompts.ts`. **Auth-ready:** every function takes an optional `token` (default `process.env.GITHUB_TOKEN`); routes get it through one `getRequestToken(req)` helper; add `getRepoAccess()` returning `{ canWrite }` (ARCHITECTURE §6 "Auth-ready design").
- [ ] `GET` / `PATCH /api/maps/[id]` against Mongo, then set `REAL = true`
- [ ] Standalone PR test script: create a branch, commit 1 file, open a PR on the demo repo

### Josiah (P3)
- [x] `/api/analyze` real path (built-in demo snapshot until `getSnapshot` lands), post-filter for unknown files, `REAL = true`
- [ ] Tune `prompts.analyze` on the demo repo until ideas are **specific and cite files**. This is the moat.
- [x] `prompts.expand` + `/api/expand`
- [x] `prompts.build` + `/api/build` (full file contents → server diff via `createTwoFilesPatch` → `node.proposal`)

**Checkpoint 1 (H+4):** everyone pulls `main`. Analyzing the demo repo saves a map to Mongo; `GET /api/maps/:id` returns it from Mongo; the graph and panels render it.

## Phase 2: Integrate + Build/PR · H+4 to H+7 (about 4 PM–7 PM)

- [ ] Sebastian: `POST /api/pr` using the stored proposal (ARCHITECTURE §6 "pr"), `REAL = true`
- [ ] Joeco: map page state: one `map`, every API response → `setMap`
- [ ] Joeco + Julian: build flow UI end to end: Build it → spinner → DiffView → Open PR → PR link
- [ ] Joeco: landing → `POST /api/analyze` → redirect, with loading lines
- [ ] Julian: error states (bad URL, private repo, Gemini failure) show a readable message, never a blank screen
- [ ] Sebastian: deterministic part of `POST /api/sync` (`Merge pull request #N` → node `shipped`)

**Checkpoint 2 (H+7):** on the deployed site, click a node on the demo repo, see a diff, and get a **real PR on GitHub**.

## Phase 3: Sync loop · H+7 to H+9 (about 7 PM–9 PM)

- [ ] Josiah: `prompts.sync` + validation (ids exist, `detected`, `sprouts`)
- [ ] Sebastian: wire the AI part into `/api/sync`, update `lastSyncedSha`, push events
- [ ] Joeco: poll `/api/sync` every 20 s (pause during in-flight build/PR); animate shipped (green) and sprouted nodes
- [ ] Julian: activity feed shows commit / ship / sprout / detect events nicely

**Checkpoint 3 (H+9):** merge the PR on GitHub → within 30 s the node turns green and 2–3 ideas sprout. Push a hand-written commit → a "detected" node appears.

## Phase 4: Harden · H+9 to H+11 (about 9 PM–11 PM)

- [ ] Josiah: AI cache on; pre-run analyze/expand/build for the demo repo so the demo runs from cache
- [ ] Julian: production deploy on the GoDaddy domain; env vars set on DO
- [ ] All: full run-through of the demo script **twice on the deployed site**

### 🔒 MVP FREEZE Sat 11 PM (slide to 2 AM at most). After this, only bug fixes and polish on `main`.

## Phase 5: Polish, sleep, ship

- [ ] **After the freeze:** polish visuals (Joeco leads). At most **one** stretch item, only if the run-through passed twice, **in this priority order**:
  - [ ] **GitHub OAuth login** (Sebastian): "Sign in with GitHub"; the user's token replaces the service token via `getRequestToken`; maps get an owner. Needs a §2 dependency decision and an OAuth app with callbacks for localhost and the deployed domain.
  - [ ] "Sync now" button
  - [ ] Filter by type / hide shipped
  - [ ] Create GitHub issue from a node
- [ ] **Sun 2 AM–7 AM: everyone sleeps.**
- [ ] **7–8 AM:** final run-through; record a **backup demo video** of the full loop
- [ ] **8–9 AM:** Devpost write-up, screenshots, list tracks (Microsoft, Gemini, MongoDB, DigitalOcean, GoDaddy) (Josiah + Sebastian)
- [ ] **9–10 AM: submit.** Rehearse the pitch 3× (Josiah pitches, Joeco drives the demo).

---

## Fallback rules (decide fast, don't argue)

| If at… | this isn't working | do this |
|---|---|---|
| Checkpoint 1 (H+4) | Real analyze on the demo repo | Demo from a hand-tuned cached analysis; keep the real route for other repos |
| Checkpoint 2 (H+7) | Real PR creation | Build shows the diff + "Copy prompt" + "Create issue"; PR becomes the stretch goal |
| Checkpoint 3 (H+9) | AI part of sync | Keep deterministic PR-merge detection only (merge → green); sprout via Expand |
| Checkpoint 3 (H+9) | Polling | "Sync now" button calling the same route |
| Any | Someone is blocked > 30 min | Post in chat immediately; the lead pairs with them |
| Any | Wifi / Gemini down on stage | `MOCK_MODE=true` demo, or play the backup video |

## Demo script (≈3 min)

Real repo, real Gemini calls, all pre-cached (see "AI cache" below) so the demo doesn't depend on Gemini's mood on stage.
Exact idea titles are regenerated per analyze and may drift slightly if the repo or prompts change — glance at the
live map before presenting and swap in whatever the current title is; the beats below don't depend on exact wording.

1. The problem: vibe coders keep asking the AI "what next?" and lose ideas in chat history.
2. Paste the demo repo (`chronos-scheduler`); the map blooms with ~9 ideas. Point at **"Sanitize event input titles"**
   (security) and read its rationale aloud — it names `server/index.js` passing raw title strings into `server/db.js`.
3. Expand **"Sanitize event input titles"** → 4 children sprout, including "Enforce backend payload string
   sanitization" and "Configure Content Security Policy headers."
4. Build **"Sanitize event input titles"** → diff on `src/calendar.jsx` → Open PR → show the real PR on GitHub.
5. Merge on GitHub → back in the app the node turns green and new ideas sprout.
6. A teammate pushes a hand-written commit → the map detects it and grows from it.
7. Close: "Your codebase becomes a map you steer, not a chat you type into."

**AI cache:** all 9 top-level ideas on the demo repo have cached Build results, and "Sanitize event input titles" has
a cached Expand too, so steps 2–4 run instantly with `AI_CACHE=on`. If the repo or prompts change, re-run analyze +
build (all nodes) + expand (the security node) once before presenting to refresh the cache.
