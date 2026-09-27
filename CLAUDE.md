# Instructions for coding agents (and humans)

This is **Spitball**, a hackathon project with a hard MVP deadline of **Sat 11 PM**.

## Read first, every session
0. `docs/index.md`: where every kind of information lives, including where to read library docs.
1. `docs/ARCHITECTURE.md`: what we're building, stack, folder ownership, types, API contract.
2. `docs/PLAN.md`: current phase and the task you're on.
3. `docs/CONTEXT.md`: why things were decided, the pitch, the demo script. Read once per session.
4. `docs/prototype.html`: clickable reference for the UI and the core loop. Match its behavior; reuse its `IDEAS` data for mocks.

## Rules
- **Stay in your owner's files** (ARCHITECTURE §4). If a change is needed in someone else's file, stop and tell the human so they can ask the owner.
- **`src/lib/types.ts` is the shared contract.** Do not change it unless the human confirms the team agreed. Import types from it; never redefine them locally.
- **Follow the API contract in ARCHITECTURE §6 exactly**: route paths, request bodies, and response shapes. Every mutating route returns `{ map: CodeMap }`.
- **No new dependencies** unless they're listed in ARCHITECTURE §2. Ask the human first.
- Secrets live in `.env.local` only. Never hardcode keys, never commit `.env*`, and never expose `GEMINI_API_KEY` / `GITHUB_TOKEN` to client components (no `NEXT_PUBLIC_` prefix).
- Frontend work can run with `MOCK_MODE=true` and needs no keys.
- Keep changes small and focused on one task. Don't refactor code you weren't asked to touch.
- All AI responses go through `generateJSON()` in `src/lib/gemini.ts` with a zod schema. Never `JSON.parse` model output anywhere else.
- Before saying a task is done: `npm run build` passes, and you've described how to test it manually.
- When a task is finished, tick its checkbox in `docs/PLAN.md`.
- Out of scope (don't build): chat UI, live keystroke watching, auto-merge, multi-user accounts/teams. GitHub sign-in (OAuth, private repos) is built: see ARCHITECTURE §6. Every `github.ts` function takes an optional `token`; routes get it only via `getRequestToken(req)`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
