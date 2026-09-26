# ProjectGraph — Index

**Start here.** This file says where every kind of information lives. Humans and coding agents: find your question below, read *only* that source, then work.

## 1. Project docs (read in this order, once per session)

| File | Read it for |
|---|---|
| `CLAUDE.md` (repo root) | Hard rules: file ownership, API contract, no new deps, secrets, "done" checklist |
| `docs/ARCHITECTURE.md` | What we're building, stack (§2), folder ownership (§4), shared types (§5), API contract (§6), Gemini rules (§7), UI behavior (§8), env vars (§9), git workflow (§10) |
| `docs/PLAN.md` | Who owns what, sleep shifts, the current phase, your task checklist, fallback rules |
| `docs/CONTEXT.md` | Why decisions were made, the pitch, differentiation, demo script |
| `docs/prototype.html` | The intended look and interactions. Open in a browser. Its `IDEAS` object is fixture data |
| `CODEX_PROJECT_PROMPT.md` | **Not authoritative.** An early idea prompt that assumes Vite + FastAPI and an approve/reject flow. The team chose Next.js; if it disagrees with the docs above, the docs win |

## 2. Where to look for a specific question

| Question | Go to |
|---|---|
| What are the types? | `src/lib/types.ts` (the contract; never edit alone) |
| What does route X take and return? | `docs/ARCHITECTURE.md` §6, then `src/app/api/<route>/route.ts` |
| Can I edit this file? Who owns it? | `docs/ARCHITECTURE.md` §4 and the roles table in `docs/PLAN.md` |
| What should I work on now? | `docs/PLAN.md`, your name, the current phase |
| How do I run with no keys? | `MOCK_MODE=true` in `.env.local`; fixture in `src/lib/mock.ts` |
| Which env vars exist? | `.env.example` and `docs/ARCHITECTURE.md` §9 |
| How do AI calls work? | `src/lib/gemini.ts` (`generateJSON`), `src/lib/schemas.ts` (zod), `src/lib/prompts.ts` |
| What must the AI prompts guarantee? | `docs/ARCHITECTURE.md` §7 "Prompt rules" |
| How should nodes look? | `docs/ARCHITECTURE.md` §8 and `docs/prototype.html` |
| Is X in scope? | `CLAUDE.md` (out of scope list) and `docs/ARCHITECTURE.md` §12 |

## 3. Code map

```
src/app/page.tsx              landing page
src/app/map/[id]/page.tsx     map page (graph + panels, polling)
src/app/api/*/route.ts        analyze, maps/[id], expand, build, pr, sync
src/components/               Graph (+ GraphCanvas), Legend, DetailPanel, DiffView, ActivityFeed, Header
src/lib/types.ts              shared contract
src/lib/schemas.ts            zod + Gemini response schemas
src/lib/prompts.ts            prompt builders
src/lib/gemini.ts             generateJSON() and AI cache
src/lib/mock.ts               MOCK_MODE fixture and in-memory store
src/lib/github.ts, db.ts      GitHub (Octokit) and MongoDB (planned; see PLAN.md)
src/lib/api-client.ts         typed fetch wrappers used by all UI
```

## 4. Library documentation (use these, not memory)

Model knowledge of these libraries can be out of date. Read the installed version's docs.

| Library | Where |
|---|---|
| **Next.js 16** (App Router, route handlers, `params` is a Promise) | `node_modules/next/dist/docs/` (start at `index.md`, then `01-app/`). **Read the relevant guide before writing Next.js code.** |
| **Gemini SDK** `@google/genai` | `node_modules/@google/genai/dist/genai.d.ts` (search `generateContent`, `responseJsonSchema`) |
| **zod 4** | `node_modules/zod/` typings; `z.toJSONSchema()` is used in `schemas.ts` |
| **Octokit** `@octokit/rest` | `node_modules/@octokit/rest/` and its plugin typings; GitHub REST docs for the endpoint names used in ARCHITECTURE §6 |
| **MongoDB driver** | `node_modules/mongodb/mongodb.d.ts` |
| **react-force-graph-2d** | `node_modules/react-force-graph-2d/` README and typings |
| **diff** | `node_modules/diff/` typings (`createTwoFilesPatch`) |
| **Tailwind CSS 4** | `src/app/globals.css` uses `@import "tailwindcss"`; official docs for utilities |

## 5. Rules of thumb for agents

- Do not guess. If this index, `CLAUDE.md` and the docs don't answer it, ask the human.
- Change only files you own (`ARCHITECTURE.md` §4). Otherwise tell the human.
- Update this file when you add a folder, a doc, or a source of truth.
