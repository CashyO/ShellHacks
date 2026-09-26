import type { IdeaNode } from "./types";

/** Shape returned by github.getSnapshot(); github.ts should import this type. */
export interface Snapshot {
  defaultBranch: string;
  headSha: string;
  tree: string[];
  files: { path: string; content: string }[];
}

const RULES = `Rules for every idea:
- The "rationale" MUST name a real file or function from the code provided.
- Only reference files that appear in the FILE TREE. A new file is allowed only inside an existing folder.
- Never suggest something the code already does.
- Do NOT suggest: dark mode, login/auth, generic "add tests", "improve UI", "add comments", "refactor" - unless the code specifically justifies it.
- Titles are at most 5 words. Descriptions are at most 2 sentences.
- Use a mix of types. Include at least one "security" or "fix" idea when there is a real reason in the code.
- effort: S = under an hour, M = a few hours, L = a day or more.`;

const renderFiles = (files: Snapshot["files"]) =>
  files.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");

const renderTree = (tree: string[]) => tree.join("\n");

export function analyze(s: Snapshot): string {
  return `You are a senior engineer reviewing a GitHub repository to suggest what to build next.

Return a short summary of what the app is, its tech stack, and 8 to 12 specific, buildable ideas grounded in this code.

${RULES}

FILE TREE:
${renderTree(s.tree)}

CODE:
${renderFiles(s.files)}`;
}

export function expand(args: {
  summary: string;
  tree: string[];
  parent: IdeaNode;
  existingTitles: string[];
}): string {
  const { summary, tree, parent, existingTitles } = args;
  return `You are a senior engineer extending an idea map for a codebase.

APP: ${summary}

Generate 3 to 5 follow-up ideas that build directly on this idea:
Title: ${parent.title}
Description: ${parent.description}
Rationale: ${parent.rationale}
Files: ${parent.files.join(", ")}

Do NOT repeat or closely overlap any of these existing ideas:
${existingTitles.map((t) => `- ${t}`).join("\n")}

${RULES}

FILE TREE:
${renderTree(tree)}`;
}

export function build(args: {
  summary: string;
  node: IdeaNode;
  files: { path: string; content: string | null }[];
}): string {
  const { summary, node, files } = args;
  const rendered = files
    .map((f) => (f.content === null ? `=== ${f.path} (NEW FILE, does not exist yet) ===` : `=== ${f.path} ===\n${f.content}`))
    .join("\n\n");
  return `You are a careful engineer implementing one change in an existing codebase.

APP: ${summary}

CHANGE TO IMPLEMENT
Title: ${node.title}
Description: ${node.description}
Rationale: ${node.rationale}

Rules:
- Return the COMPLETE new contents of every file you change. Never return a patch or a partial file.
- Change at most 3 files, and only the files needed. Keep the change small and focused.
- Preserve existing code style, imports, and behavior that is unrelated to this change.
- Set isNew to true only for files that do not exist yet.
- prTitle: a short conventional-commit style title. prBody: 2-4 sentences on what changed and why.

CURRENT FILES:
${rendered}`;
}

export function sync(args: {
  summary: string;
  commits: { sha: string; message: string }[];
  patches: { path: string; patch: string }[];
  openNodes: Pick<IdeaNode, "id" | "title" | "files">[];
}): string {
  const { summary, commits, patches, openNodes } = args;
  return `You are watching a GitHub repository for new commits and updating its idea map.

APP: ${summary}

NEW COMMITS:
${commits.map((c) => `${c.sha.slice(0, 7)} ${c.message}`).join("\n")}

CHANGED FILES (patches, truncated):
${patches.map((p) => `=== ${p.path} ===\n${p.patch}`).join("\n\n")}

OPEN IDEAS (not yet shipped):
${openNodes.map((n) => `- id=${n.id} | ${n.title} | files: ${n.files.join(", ")}`).join("\n")}

Return:
- shippedIds: ids of OPEN IDEAS that these commits clearly implemented. Only include an id if the patches actually do the work. Use only ids listed above.
- detected: if the commits add a real feature that matches NO open idea, describe it as an idea (it is already built). Otherwise null.
- sprouts: 2 to 3 NEW ideas that build on what was just shipped or detected. parentId must be an id from shippedIds, or "detected" if it builds on the detected feature.

${RULES}`;
}
