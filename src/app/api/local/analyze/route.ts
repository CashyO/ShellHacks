import { NextResponse } from "next/server";
import { saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeLocalError, LOCAL_OWNER, localGuard, saveTree } from "@/lib/local";
import * as prompts from "@/lib/prompts";
import { AnalyzeJson, AnalyzeSchema, filterByTree, newId, toNode } from "@/lib/schemas";
import type { CodeMap } from "@/lib/types";

// POST { name, branch, headSha, tree, files } -> { map }. Same as /api/analyze, but the snapshot comes
// from the developer's local checkout (sent by the VS Code extension) instead of GitHub.
export async function POST(req: Request) {
  const guard = localGuard();
  if (guard) return guard;

  try {
    const body = (await req.json()) as {
      name?: string;
      branch?: string;
      headSha?: string;
      tree?: string[];
      files?: { path: string; content: string }[];
    };
    const { name, branch = "main", headSha = "", tree = [], files = [] } = body;
    if (!name || !files.length) return NextResponse.json({ error: "name and files are required" }, { status: 400 });

    const result = await generateJSON(
      prompts.analyze({ defaultBranch: branch, headSha, tree, files }),
      AnalyzeJson,
      AnalyzeSchema,
    );
    const ideas = filterByTree(result.ideas, tree).slice(0, 12);
    if (ideas.length < 3) {
      return NextResponse.json({ error: "Couldn't find enough grounded ideas for this repo. Try again." }, { status: 502 });
    }

    const now = new Date().toISOString();
    const map: CodeMap = {
      _id: newId(),
      repo: { owner: LOCAL_OWNER, name, defaultBranch: branch, url: "#" },
      summary: result.summary,
      stack: result.stack,
      lastSyncedSha: headSha,
      nodes: ideas.map((d) => toNode(d, { parentId: null, origin: "analyze" })),
      events: [{ at: now, kind: "analyze", text: `Analyzed local repo ${name} and found ${ideas.length} ideas` }],
      createdAt: now,
      updatedAt: now,
    };
    await saveTree(map._id, tree);
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeLocalError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
