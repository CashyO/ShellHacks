# ProjectGraph — Project Context & Decisions

Background for anyone (human or agent) joining mid-hackathon. The *what to build* lives in ARCHITECTURE.md and the *when* in PLAN.md. This file explains *why*.

## Hackathon
- ShellHacks at FIU. Fri 11 PM → Sun 11 AM (36 h). Team of 4, all first-time hackathoners, mostly beginners.
- MVP freeze: **Sat 11 PM (H24)**. Submit by **Sun 10 AM**.
- Tracks we're entering: **Microsoft** (AI inside a non-chat experience; the core can't be a chatbot), **Best Use of Gemini**, **MongoDB Atlas**, **DigitalOcean**, **GoDaddy Registry**.
- Deliberately skipped: Assurant, Snowflake, Building Together (it pulled the product toward a generic project-management tool).

## Pitch (final)
> Vibe coding is fast, but you're always asking the AI "what should I build next?" and losing ideas in chat history. ProjectGraph watches your GitHub repo and grows a living mind map of your project: every push turns finished ideas green and sprouts new ones built on what you just wrote. Click any bubble, preview the change, and it opens a real pull request for you. Your codebase becomes a map you steer, not a chat you type into.

## Problem → Solution
- **Problem:** Vibe coders and student builders can generate code fast but lose the big picture. They don't know what to build next, ideas die in chat history, and nothing tracks what shipped.
- **Solution:** An idea map grounded in the actual code, updated automatically by commits, and executable: a bubble becomes a PR.

## The core loop (what the demo must show)
`push code → map grows → click bubble → diff → PR opens → merge → bubble turns green → new ideas sprout`

If only one thing works on stage, it must be **merge → green → sprout**. That is what separates us from every alternative.

## Differentiation (for Q&A)
- **vs Miro / NotebookLM:** they make pictures of information you give them. ProjectGraph is wired to a live codebase in both directions: code → map (sync) and map → code (PRs). "Miro and NotebookLM map what you know. ProjectGraph maps what your code could become, then builds it."
- **vs "just use Miro's MCP with Claude Code":** that gives a one-off snapshot. It doesn't update on push, the stickies carry no status/PR/commit state, and clicking a sticky does nothing. The product is the wiring, done automatically.
- **vs Cursor / Claude Code / Copilot:** they're chat-driven and optimized for the next edit. We're optimized for the next decision, and we sit in front of them (Copy-prompt / PR handoff).
- **vs Linear / GitHub Projects:** roadmaps written and updated by hand, blind to the code.
- **Moat = suggestion quality.** Every idea must cite a real file or function. Generic ideas ("add dark mode") kill the demo.
- Future/roadmap line: ProjectGraph could expose its own MCP server so coding agents read and update the map.

## Key decisions and why
| Decision | Why |
|---|---|
| React to **pushes**, not keystrokes | Keystroke watching needs a VS Code extension or daemon: a day of work, invisible to judges |
| **Human confirms** the diff before the PR | Generated code can be wrong; judges will ask who reviews it |
| Changes capped at **1–3 files**, full-file output | Reliability. Models write broken patches, so the server makes the diff |
| **Deterministic** PR-merge detection before AI | Keeps the demo's key moment reliable |
| **AI response cache** in Mongo | Fast, repeatable demo |
| **One Next.js app** (not Vite + FastAPI) | One language, one set of types, one deploy. Also, SQLite would be wiped on DigitalOcean redeploys and would forfeit the MongoDB track |
| **react-force-graph-2d** | Organic Obsidian-style bloom out of the box. (React Flow + d3-force is an acceptable swap if HTML nodes are needed) |
| No tree-sitter, no git CLI, no LangChain/agent frameworks | No demo value within 36 h; three or four good prompts are enough |
| Demo on **our own small repo** (`chronos-scheduler`) | Controlled, pre-tested, cached |

## Reference prototype
`docs/prototype.html` is a clickable HTML/JS mock with simulated data. Open it in a browser. It shows the intended look, node states (suggested dashed / PR-open pulsing / shipped green), the detail panel, diff preview, activity feed, root progress ring, and the full loop. Match its interactions; the example ideas in its `IDEAS` object are good fixture data for `src/lib/mock.ts`.

## Demo script (~3 min)
1. The problem (15 s).
2. Paste the demo repo URL; the map blooms. Point at an idea citing a real file.
3. Expand a node → children sprout.
4. Build "Validate POST /events" → diff → Open PR → show the real PR on GitHub.
5. Merge on GitHub → the node turns green in the app, and new ideas sprout.
6. Teammate pushes a hand-written commit → the map detects it and grows.
7. Close: "Your codebase becomes a map you steer, not a chat you type into."
