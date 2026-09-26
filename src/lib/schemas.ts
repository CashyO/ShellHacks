import { z } from "zod";

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
