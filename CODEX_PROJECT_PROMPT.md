You are acting as the lead software architect, technical project manager, and senior developer for this repository.

Your job is to analyze the current repository, understand the intended product described below, and produce a complete development plan for the project. Do not begin implementing features until you have first created the project plan, task breakdown, dependencies, and recommended development sequence.

# PROJECT NAME

ProjectGraph

# PRODUCT VISION

ProjectGraph is an AI-native developer tool that analyzes a developer's software repository and optional developer context, then generates an interactive Obsidian-style feature graph.

Each graph node represents a concrete proposed improvement to the project, such as:

- new feature
- bug fix
- refactor
- test improvement
- infrastructure improvement

The proposals should be grounded in evidence found in the repository or developer-provided context.

Examples of evidence include:

- TODO or FIXME comments
- README roadmap items
- missing functionality implied by existing code
- GitHub issues
- missing tests
- architectural inconsistencies
- explicit developer notes
- features discussed but not yet implemented

The developer can inspect each generated feature node and either:

- approve it
- reject it

When a feature is approved, a coding agent should eventually be able to:

1. create an implementation plan
2. identify relevant files
3. create a Git branch
4. modify the repository
5. run tests
6. commit the changes
7. push the branch
8. create a GitHub pull request
9. update the feature node status to PR_READY

The long-term vision is to make ProjectGraph a visual control plane for AI coding agents.

The hackathon MVP does NOT need to support the entire long-term vision.

# CORE HACKATHON USER FLOW

The MVP must demonstrate this complete vertical slice:

Repository
→ Analyze repository
→ Generate feature proposals
→ Display feature dependency graph
→ Developer clicks a feature
→ Developer reviews evidence and implementation information
→ Developer approves the feature
→ Coding agent modifies the project
→ Tests run
→ Git branch is created
→ Pull request is created
→ Feature node changes to PR_READY

This complete end-to-end flow is more important than adding many features.

# TECH STACK

Frontend:

- Vite
- React
- TypeScript
- React Flow / @xyflow/react
- Material UI
- Axios

Backend:

- Python
- FastAPI
- Pydantic
- SQLite for MVP persistence

Repository tooling:

- native Git CLI where practical
- GitHub REST API or PyGithub
- Tree-sitter only if it provides enough value within hackathon time

AI:

- LLM API capable of code reasoning and structured JSON output
- repository analysis agent
- implementation/coding agent

Do not introduce unnecessary infrastructure such as:

- Kubernetes
- microservices
- Redis
- PostgreSQL unless absolutely needed
- complex agent frameworks
- vector databases unless simple retrieval becomes insufficient
- VS Code extension development
- mobile applications
- multi-user authentication
- billing

The architecture should remain intentionally simple for the hackathon.

# EXPECTED REPOSITORY ARCHITECTURE

Prefer a structure close to:

projectgraph/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── hooks/
│   └── ...
│
├── backend/
│   ├── main.py
│   ├── api/
│   ├── agents/
│   ├── repo/
│   ├── git/
│   ├── models/
│   ├── services/
│   └── tests/
│
├── README.md
└── .gitignore

Do not force this structure if the repository already contains an equivalent clean architecture.

# CORE DOMAIN MODELS

At minimum, reason about the following entities.

Project

Represents an analyzed repository.

FeatureProposal

Suggested fields:

- id
- title
- description
- category
- reason
- evidence
- affected_files
- dependencies
- complexity
- confidence
- status
- branch_name
- pull_request_url

Feature categories:

- FEATURE
- BUG
- REFACTOR
- TEST
- INFRASTRUCTURE

Feature statuses:

- PROPOSED
- APPROVED
- BUILDING
- TESTING
- PR_READY
- REJECTED
- FAILED

FeatureEdge

Represents relationships between feature proposals.

MVP edge types:

- depends_on
- related_to

AgentExecution

Represents an execution attempt for an approved feature.

Potential fields:

- feature_id
- status
- started_at
- completed_at
- branch_name
- test_result
- error_message
- pull_request_url

# FEATURE PROPOSAL REQUIREMENTS

AI-generated proposals must not be arbitrary ideas.

Every proposal should include evidence.

The analyzer should prefer proposals supported by:

1. explicit developer intent
2. TODO/FIXME comments
3. README roadmap statements
4. GitHub issues
5. missing tests
6. obvious architectural gaps
7. functionality implied by the existing architecture
8. dependencies required by another feature

The AI should avoid generic suggestions such as:

- add dark mode
- add notifications
- add an AI assistant
- add analytics
- add social login

unless repository evidence supports them.

Feature generation should generally produce approximately 3–6 useful proposals for the hackathon demonstration.

# GRAPH EXPERIENCE

The frontend should visually represent proposals as nodes.

Each node should display enough information to understand:

- title
- category
- status
- complexity

Clicking a node should open a detail panel containing:

- feature title
- description
- why it was proposed
- supporting evidence
- affected files
- dependencies
- complexity
- confidence
- implementation status
- PR link if available
- Approve button
- Reject button

Graph relationships should visually show dependencies.

Example:

Refactor Authentication
        ↓
Google OAuth

means Google OAuth depends on the authentication refactor.

# REPOSITORY ANALYSIS

The repository analyzer should initially prioritize simplicity.

MVP analysis should consider:

- directory structure
- source files
- README
- dependency files
- configuration files
- tests
- TODO/FIXME comments
- detected framework/language
- important application domains

Do not immediately build a sophisticated semantic code search system.

Start with:

- file tree analysis
- text search
- relevant file extraction
- LLM reasoning

Tree-sitter or semantic retrieval can be added later if needed.

# DEVELOPER CONTEXT

The MVP should support optional developer context.

For the hackathon, this can simply be:

- a textarea
- uploaded developer-notes.md
- pasted project notes

Example:

"Eventually support multiple workspaces.
Production should use PostgreSQL.
Do not add OAuth.
Search performance needs improvement."

The AI should use these notes as project intent.

Explicit negative intent such as:

"Do not add OAuth."

must be respected.

# BACKEND API

Consider an MVP API similar to:

POST /projects/analyze

Analyzes a repository and creates a project.

GET /projects/{project_id}/graph

Returns graph nodes and edges.

GET /features/{feature_id}

Returns feature details.

POST /features/{feature_id}/approve

Approves a feature and begins execution.

POST /features/{feature_id}/reject

Rejects a proposal.

GET /features/{feature_id}/status

Returns current execution status.

You may improve this API if you identify a simpler or cleaner design.

# AGENT EXECUTION

Do not over-engineer a multi-agent architecture.

For the MVP, use approximately three logical responsibilities:

ANALYZER

Responsibilities:

- inspect repository
- inspect developer context
- produce structured FeatureProposal objects
- infer simple dependencies

IMPLEMENTER

Responsibilities:

- receive approved proposal
- determine relevant files
- generate implementation plan
- modify code
- run project tests
- prepare Git changes

REVIEWER or VALIDATOR

Responsibilities:

- verify changes are relevant
- confirm tests pass
- inspect unexpected file modifications
- determine whether PR creation should proceed

These responsibilities may internally use the same LLM if that keeps the architecture simpler.

# GIT WORKFLOW

Approved feature execution should eventually support:

git switch main
git pull
git switch -c agent/<feature-name>

make changes

run tests

git add
git commit

git push

create GitHub pull request

The system must never automatically push directly to main.

Each generated feature must operate on its own branch.

# SECURITY REQUIREMENTS

Never:

- request or store a user's GitHub password
- commit API keys
- commit .env files
- expose secrets to frontend code
- allow arbitrary shell execution originating directly from model output without validation
- push directly to main

Use environment variables for:

- LLM API credentials
- GitHub tokens
- repository access credentials

Generated shell commands and file modifications should be constrained to the working repository.

# HACKATHON SCOPE

The MVP MUST prioritize:

P0:

- repository ingestion
- repository analysis
- structured feature proposal generation
- feature graph visualization
- node detail panel
- approve/reject flow
- agent implementation of at least one feature
- Git branch creation
- test execution
- real pull-request creation
- node status updates

P1:

- developer notes/context
- evidence display
- dependency edges
- better status visualization
- failed test handling

P2:

- Tree-sitter
- parallel agents
- conflict detection
- semantic code retrieval
- PR diff viewer

P3 / POST-HACKATHON:

- VS Code extension
- CLI
- ChatGPT history integration
- Slack
- Discord
- Jira
- Linear
- advanced agent scheduling
- multiple coding-agent providers
- organizations and teams
- billing
- production-scale sandboxing

Do not allow P2/P3 work to delay the P0 vertical slice.

# DEVELOPMENT PHILOSOPHY

Build the vertical slice before building sophisticated intelligence.

Recommended progression:

1. Render fake graph data in frontend.
2. Build backend API.
3. Connect frontend graph to backend.
4. Clone/read a repository.
5. Generate real feature proposals.
6. Approve a feature.
7. Make an agent modify a small test repository.
8. Run tests.
9. Create branch.
10. Create PR.
11. Update graph status.
12. Add intelligence and polish afterward.

At every phase, prefer a working end-to-end system over incomplete sophisticated components.

# YOUR CURRENT TASK

First inspect the repository.

Then produce a PROJECT DEVELOPMENT PLAN.

Do NOT immediately start implementing everything.

Your response should contain the following sections.

## 1. Repository Assessment

Describe:

- current repository structure
- existing frontend/backend setup
- installed dependencies
- what has already been implemented
- important missing setup
- technical risks

Do not claim files or features exist unless you actually verify them.

## 2. Finalized MVP

Define exactly what should and should not be included during the hackathon.

Explicitly separate:

MUST HAVE

SHOULD HAVE

STRETCH

POST-HACKATHON

## 3. System Architecture

Describe the proposed architecture.

Explain:

- frontend responsibilities
- backend responsibilities
- AI responsibilities
- repository analysis
- Git/GitHub layer
- persistence
- communication between components

Provide an ASCII architecture diagram.

## 4. Project Epics

Break the project into major epics.

Suggested examples:

EPIC 1 — Project/Foundation Setup
EPIC 2 — Graph Frontend
EPIC 3 — Backend API
EPIC 4 — Repository Analysis
EPIC 5 — Feature Proposal Agent
EPIC 6 — Human Approval Workflow
EPIC 7 — Implementation Agent
EPIC 8 — Git/GitHub Automation
EPIC 9 — Testing and Validation
EPIC 10 — Integration and Demo

Improve or restructure these if appropriate.

## 5. Tasks and Subtasks

For EVERY epic, create concrete tasks and subtasks.

Use identifiers such as:

PG-001
PG-002
PG-003

Each task must include:

- title
- description
- required subtasks
- dependencies
- files/components likely affected
- estimated difficulty: Low / Medium / High
- priority: P0 / P1 / P2 / P3
- definition of done

Example structure:

PG-014 — Build Feature Graph API

Priority: P0
Difficulty: Medium
Depends on: PG-008

Description:
Return graph-compatible feature proposal data.

Subtasks:
- Define response schema.
- Fetch FeatureProposal records.
- Fetch FeatureEdge records.
- Convert them into node/edge objects.
- Add API tests.

Definition of Done:
GET /projects/{id}/graph returns valid node and edge data consumed successfully by React Flow.

## 6. Dependency Graph

Show which major tasks depend on one another.

Example:

PG-001
   ↓
PG-004
   ↓
PG-009
   ├── PG-010
   └── PG-011
         ↓
      PG-015

Clearly identify tasks that can happen in parallel.

## 7. Hackathon Development Order

Create the recommended chronological implementation order.

Optimize for the fastest path to the complete vertical slice.

Do not simply order tasks by subsystem.

For example:

Repository setup
→ fake graph
→ backend contract
→ frontend/backend integration
→ repository scanner
→ AI proposal generation
→ approval
→ code modification
→ tests
→ Git branch
→ PR
→ polish

## 8. Hackathon Timeline

Provide timelines for:

- 24-hour hackathon
- 36-hour hackathon
- 48-hour hackathon

For each timeline identify:

- milestone targets
- checkpoints
- which features must be cut if behind schedule

## 9. Team Parallelization

Provide development assignments for:

- solo developer
- 2 developers
- 3 developers
- 4 developers

Identify which files/subsystems each person should own to minimize merge conflicts.

## 10. Git Strategy

Recommend branch names for the identified tasks.

Examples:

feature/frontend-graph
feature/backend-api
feature/repository-analyzer
feature/proposal-agent
feature/github-integration

Explain when branches should merge into main.

## 11. Technical Risks

Identify likely failures such as:

- LLM generating weak proposals
- context limits
- agent modifying wrong files
- test command detection
- GitHub authentication
- merge conflicts
- long AI latency
- malformed structured outputs
- arbitrary shell commands
- live demo instability

For each risk provide a hackathon-safe mitigation.

## 12. Demo Plan

Design a 60–120 second judging demo.

The demo should show:

repository
→ analyze
→ feature graph
→ select feature
→ show evidence
→ approve
→ BUILDING
→ TESTING
→ PR_READY
→ real GitHub PR

Identify which feature in the demo repository should be selected so implementation is reliable.

## 13. Immediate Next Tasks

At the end, provide only the next 3–5 tasks that should actually be worked on immediately.

Do not overwhelm the team with the entire backlog at this stage.

# IMPORTANT BEHAVIOR RULES

- Inspect before assuming.
- Do not modify code until the planning phase is complete.
- Prefer minimal architecture.
- Optimize for hackathon completion.
- Protect the P0 vertical slice.
- Avoid unnecessary libraries.
- Avoid speculative features.
- Make generated proposals evidence-backed.
- Keep human approval between proposal generation and code execution.
- Never push generated code directly to main.
- Call out uncertainty instead of inventing repository details.
- When implementation begins, work in small independently testable increments.
- After each major implementation task, run the appropriate tests/build command.
- Before changing several files, explain which files will be modified and why.
- Do not rewrite working parts of the repository unnecessarily.

Begin by inspecting the current repository and producing the development plan described above.