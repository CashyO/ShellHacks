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
  dependsOn?: string[];       // ids of other nodes that should ship first (manual planning, not enforced)
  rejectedBy?: string;        // GitHub login who rejected it, if signed in
  rejectedNote?: string;      // why, for teammates who see it later in the activity feed
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
