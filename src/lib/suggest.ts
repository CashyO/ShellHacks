import { z } from "zod";
import { IdeaDraftSchema, toGeminiSchema } from "./schemas";
import type { IdeaNode } from "./types";

// The passive agent: the VS Code extension sends what the developer is doing right now (active file,
// cursor, errors, uncommitted diff) and the agent pitches ideas for that moment.
// Kept out of prompts.ts / schemas.ts so this feature doesn't touch P3's files.

/** What the developer is looking at in VS Code right now. */
export interface Focus {
  file: string;
  line: number;
  symbol?: string;            // innermost function/class around the cursor, e.g. "remove"
  snippet: string;            // code around the cursor
  selection?: string;
  diagnostics?: string[];     // "12: error: Cannot find name 'x'"
  recentFiles?: string[];
}

export const SuggestSchema = z.object({
  thought: z.string().describe("One short sentence: what the developer seems to be doing right now, in second person"),
  ideas: z
    .array(
      z.object({
        parentId: z.string().describe('id of the existing idea this builds on, or "root"'),
        idea: IdeaDraftSchema,
      }),
    )
    .max(2),
});
export const SuggestJson = toGeminiSchema(SuggestSchema);

function renderFocus(f: Focus): string {
  return `FILE: ${f.file} (cursor on line ${f.line}${f.symbol ? `, inside ${f.symbol}` : ""})
${f.snippet}
${f.selection ? `\nSELECTED:\n${f.selection}\n` : ""}${f.diagnostics?.length ? `\nPROBLEMS IN THIS FILE:\n${f.diagnostics.join("\n")}\n` : ""}${f.recentFiles?.length ? `\nRECENTLY VIEWED: ${f.recentFiles.join(", ")}\n` : ""}`;
}

export function suggestPrompt(args: {
  summary: string;
  diff: string;
  focus?: Focus;
  nodes: Pick<IdeaNode, "id" | "title" | "status" | "files">[];
  tree: string[];
}): string {
  const { summary, diff, focus, nodes, tree } = args;
  return `You are a senior engineer pair-programming with a developer, watching their editor.
Pitch ideas that are relevant to exactly what they are working on at this moment.

APP: ${summary}

${focus ? `WHERE THEY ARE RIGHT NOW:\n${renderFocus(focus)}\n` : ""}
WORK IN PROGRESS (uncommitted, git diff against HEAD, truncated):
${diff || "(none)"}

EXISTING IDEAS ON THE MAP:
${nodes.map((n) => `- id=${n.id} | ${n.status} | ${n.title} | files: ${n.files.join(", ")}`).join("\n")}

Return:
- thought: one short sentence on what they are doing right now ("You're adding ... to ...").
- ideas: 0 to 2 ideas. Return an empty list unless the current code clearly points to a useful next step.
  - Prefer ideas about the file and function they are in. If there are PROBLEMS, a "fix" idea for them is welcome.
  - Each rationale must name a file or function from the code shown above.
  - Never repeat or closely overlap an existing idea, and never suggest what the code already does.
  - parentId: the id of the existing idea this builds on most closely (prefer one whose files include their current file), or "root".
  - Only reference files from the FILE TREE, or new files inside an existing folder.
  - Titles are at most 5 words. Descriptions are at most 2 sentences.
  - effort: S = under an hour, M = a few hours, L = a day or more.

FILE TREE:
${tree.join("\n")}`;
}
