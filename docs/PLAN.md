# Offshoot — Build Plan

Hackathon clock: started **Fri 11 PM** (H0). Now ≈ **H6 (Sat 5 AM)**.
**MVP frozen at H24 (Sat 11 PM).** H24–H36 = polish, sleep, demo, submit. Submission deadline **Sun 11 AM**. Submit by **10 AM**.

Tick boxes as you finish them. Each phase has an **exit check**; don't start the next phase's integration until it passes.

## Roles

| Who | Role | Owns |
|---|---|---|
| **P1** | Graph (frontend) | `Graph.tsx`, `Legend.tsx`, `map/[id]/page.tsx`, polling, animations |
| **P2** | Panels (frontend) | `page.tsx` (landing), `DetailPanel`, `DiffView`, `ActivityFeed`, `Header`, `api-client.ts` |
| **P3** | AI (backend) | `types.ts`, `schemas.ts`, `prompts.ts`, `gemini.ts`, `mock.ts`, routes `analyze`, `expand`, `build` |
| **P4** | GitHub + infra + demo | `github.ts`, `db.ts`, routes `maps`, `pr`, `sync`, DO deploy, domain, demo repo, Devpost |

The strongest dev takes **P4**, because PR plumbing and deploy are the least forgiving parts. They also own merging to `main`.

---

## Phase 0: Foundation · H6–H8 (5–7 AM) · everyone together

- [ ] P4: Create GitHub repo, `npx create-next-app@latest offshoot --ts --tailwind --app --src-dir`, push to `main`
- [ ] P4: Add `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md`, `.env.example`; add all 3 teammates as collaborators
- [x] P3: Create `src/lib/types.ts` exactly as in ARCHITECTURE §5; create `src/lib/mock.ts` with a realistic 12-node `CodeMap` (reuse ideas from the prototype)
- [x] P3: `MOCK_MODE` → every API route returns/updates the mock map in memory
- [ ] P4: Accounts and keys: Gemini API key (AI Studio), MongoDB Atlas free cluster + URI, GitHub PAT, DigitalOcean app connected to repo
- [ ] P4: Deploy the hello-world build to DO App Platform
- [ ] All: `npm install`, `.env.local` copied, `npm run dev` works on every laptop

**Exit check:** every laptop runs the app. `GET /api/maps/demo` returns the mock map in MOCK_MODE. The DO URL loads.

## Phase 1: Build in parallel against mocks · H8–H14 (7 AM–1 PM)

**Sleep in shifts.** P1 + P3 sleep 7–11 AM while P2 + P4 work. Then P2 + P4 sleep 11 AM–3 PM (they overlap with Phase 2; that's fine).

P1 Graph
- [ ] `Graph.tsx` renders the mock map with react-force-graph-2d (dynamic import, `ssr:false`)
- [ ] Synthetic root node + links for `parentId === null`
- [ ] Custom node drawing: color by type, size by effort, dashed/solid/green by status, labels
- [ ] Click a node → `onSelect(nodeId)`; clicking the background selects the root
- [ ] Legend overlay

P2 Panels
- [ ] Landing page: repo URL input + "Try demo repo" button → `POST /api/analyze` → redirect to `/map/[id]`
- [ ] Loading state with rotating status lines ("Reading file tree…", "Finding ideas…")
- [ ] `api-client.ts`: typed wrappers for every route in ARCHITECTURE §6
- [ ] `DetailPanel` for every status (see ARCHITECTURE §8), including Copy prompt
- [ ] `DiffView`: colors a unified diff string (+ green, − red, @@ blue)
- [ ] `ActivityFeed` renders `map.events` newest first

P3 AI
- [ ] `gemini.ts` `generateJSON()` with zod validation + 1 retry
- [ ] `schemas.ts`: Analyze, Expand, Build, Sync schemas (zod + Gemini responseSchema)
- [ ] `prompts.analyze` → test on the demo repo; iterate until ideas are **specific and cite files**
- [ ] `/api/analyze` end to end (uses P4's `getSnapshot`; stub it with a local JSON snapshot until P4 is ready)
- [ ] `prompts.expand` + `/api/expand`

P4 GitHub/DB
- [ ] `db.ts`: cached Mongo client, `getMap`, `saveMap`, `updateMap`
- [ ] `github.ts`: `parseRepoUrl`, `getSnapshot` (filters + caps from ARCHITECTURE §6)
- [ ] `GET` / `PATCH /api/maps/[id]`
- [ ] **Demo repo**: vibe-code a tiny scheduling app (~10 files) in its own repo. Keep it simple and working.
- [ ] Standalone PR test script: create a branch, commit 1 file, and open a PR on the demo repo

**Exit check:** analyzing the real demo repo saves a map to Mongo; `GET /api/maps/:id` returns it; the graph and panels render the mock map.

## Phase 2: Integrate + Build/PR · H14–H18 (1–5 PM)

- [ ] P1/P2: Switch UI from mock to real API (`MOCK_MODE=false`); map page loads a real map
- [ ] P1: Merge incoming maps into existing node objects (keep x/y); new nodes spawn at their parent
- [ ] P2: Expand button works end to end
- [ ] P3: `prompts.build` + `/api/build` (full file contents → server diff → proposal)
- [ ] P4: `/api/pr` using the stored proposal
- [ ] P2: Build flow UI: Build it → spinner → DiffView → Open PR → PR link

**Exit check:** on the deployed site, click a node on the demo repo, see a diff, and get a **real PR on GitHub**.

## Phase 3: Sync loop · H18–H22 (5–9 PM)

- [ ] P4: `/api/sync` compare commits; deterministic `Merge pull request #N` → shipped
- [ ] P3: `prompts.sync` + validation (shippedIds, detected, sprouts)
- [ ] P4: Wire the AI part into `/api/sync`, update `lastSyncedSha`, push events
- [ ] P1: Poll `/api/sync` every 20s; animate shipped (green) and sprouted nodes; root progress ring
- [ ] P2: Activity feed shows commit / ship / sprout / detect events nicely; header shows "Watching main · synced <sha>"

**Exit check:** merge the PR on GitHub → within 30s the node turns green and 2–3 new ideas sprout. Push a hand-written commit → a "detected" node appears.

## Phase 4: Harden · H22–H24 (9–11 PM)

- [ ] P3: AI cache on; pre-run analyze/expand/build for the demo repo so the demo runs from cache
- [ ] P2: Error states (bad URL, private repo, Gemini failure) show a readable message, never a blank screen
- [ ] P4: Production deploy on the GoDaddy domain; env vars set on DO
- [ ] All: Full run-through of the demo script twice on the **deployed** site

### 🔒 MVP FREEZE at H24. After this, only bug fixes and polish on `main`.

## Phase 5: Polish, sleep, ship · H24–H36

- [ ] H24–H27 (11 PM–2 AM): Polish visuals. At most **one** stretch item, only if the run-through passed:
  - [ ] "Sync now" button (manual trigger)
  - [ ] Filter by type / hide shipped
  - [ ] Create GitHub issue from a node
- [ ] H27–H32 (2–7 AM): **Sleep.** Code written tired now costs you the demo.
- [ ] H32–H33: Final run-through; record a **backup demo video** (screen recording of the full loop)
- [ ] H33–H34: Devpost write-up, screenshots, list the tracks we're entering (Microsoft, Gemini, MongoDB, DigitalOcean, GoDaddy)
- [ ] H34: **Submit by 10 AM.** Rehearse the pitch 3×.

---

## Fallback rules (decide fast, don't argue)

| If at… | this isn't working | do this |
|---|---|---|
| H14 | Real analyze on the demo repo | Demo from a hand-tuned cached analysis; keep the real route for other repos |
| H18 | Real PR creation | Build shows the diff + "Copy prompt" + "Create issue"; PR becomes the stretch goal |
| H22 | AI part of sync | Keep deterministic PR-merge detection only (merge → green); sprout via Expand |
| H22 | Polling | "Sync now" button calling the same route |
| Any | Someone is blocked > 45 min | Post in chat immediately; P4 or the lead pairs with them |

## Demo script (≈3 min)

1. The problem: vibe coders keep asking the AI "what next?" and lose ideas in chat history.
2. Paste the demo repo; the map blooms. Point at an idea that names a real file.
3. Expand "Pomodoro timer" → children sprout.
4. Build "Validate POST /events" (security) → diff → Open PR → show the real PR on GitHub.
5. Merge on GitHub → back in the app the node turns green and new ideas sprout.
6. A teammate pushes a hand-written commit → the map detects it and grows from it.
7. Close: "Your codebase becomes a map you steer, not a chat you type into."
