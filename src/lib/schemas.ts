import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { IdeaDraft, IdeaNode, NodeStatus } from "./types";

export const IdeaDraftSchema = z.object({
  title: z.string().describe("At most 5 words"),
  description: z.string().describe("1-2 sentences, user-facing"),
  rationale: z.string().describe("Why this fits the code; must name a real file or function"),
  type: z.enum(["feature", "improvement", "fix", "security", "test"]),
  effort: z.enum(["S", "M", "L"]),
  files: z.array(z.string()).describe("Paths from the provided file tree, or new files in an existing folder"),
});

export const AnalyzeSchema = z.object({
  summary: z.string().describe("1-2 sentences: what this app is"),
  stack: z.array(z.string()),
  ideas: z.array(IdeaDraftSchema).min(8).max(12),
});

export const ExpandSchema = z.object({
  ideas: z.array(IdeaDraftSchema).min(3).max(5),
});

export const BuildSchema = z.object({
  changes: z
    .array(
      z.object({
        path: z.string(),
        newContent: z.string().describe("The COMPLETE new file contents, never a patch"),
        isNew: z.boolean(),
      }),
    )
    .min(1)
    .max(3),
  prTitle: z.string(),
  prBody: z.string(),
});

export const SyncSchema = z.object({
  shippedIds: z.array(z.string()),
  detected: IdeaDraftSchema.nullable(),
  sprouts: z.array(z.object({ parentId: z.string(), idea: IdeaDraftSchema })).max(3),
});

/** Gemini `responseJsonSchema` derived from a zod schema, so the two never drift. */
export function toGeminiSchema(schema: z.ZodType): object {
  const { $schema: _omit, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _omit;
  return json;
}

export const AnalyzeJson = toGeminiSchema(AnalyzeSchema);
export const ExpandJson = toGeminiSchema(ExpandSchema);
export const BuildJson = toGeminiSchema(BuildSchema);
export const SyncJson = toGeminiSchema(SyncSchema);

export type AnalyzeResult = z.infer<typeof AnalyzeSchema>;
export type ExpandResult = z.infer<typeof ExpandSchema>;
export type BuildResult = z.infer<typeof BuildSchema>;
export type SyncResult = z.infer<typeof SyncSchema>;

export const newId = () => randomUUID().slice(0, 8);

const normalizePath = (p: string) => p.trim().replace(/^\.?\//, "");

/** A path is plausible if it exists in the tree, or is a new file inside an existing folder. */
export function isPlausiblePath(path: string, tree: string[]): boolean {
  const p = normalizePath(path);
  if (!p || p.includes("..")) return false;
  if (tree.includes(p)) return true;
  const dir = p.split("/").slice(0, -1).join("/");
  return dir === "" || tree.some((t) => t.startsWith(dir + "/"));
}

/** Post-filter from ARCHITECTURE §6: drop ideas that touch files that don't exist in the repo. */
export function filterByTree(drafts: IdeaDraft[], tree: string[]): IdeaDraft[] {
  return drafts
    .map((d) => ({ ...d, files: d.files.map(normalizePath) }))
    .filter((d) => d.files.length > 0 && d.files.every((f) => isPlausiblePath(f, tree)));
}

/** Drop drafts whose title matches one already on the map (case-insensitive). */
export function dropDuplicateTitles(drafts: IdeaDraft[], existingTitles: string[]): IdeaDraft[] {
  const seen = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return drafts.filter((d) => {
    const key = d.title.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toNode(
  draft: IdeaDraft,
  opts: { parentId: string | null; origin: IdeaNode["origin"]; status?: NodeStatus },
): IdeaNode {
  return {
    ...draft,
    id: newId(),
    parentId: opts.parentId,
    status: opts.status ?? "suggested",
    origin: opts.origin,
    createdAt: new Date().toISOString(),
  };
}

/** Unguessable id for a map (the link is the only thing protecting a private repo's map). */
export const newMapId = () => randomUUID();
