import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { isMock, mockAnalyze, saveMockMap, stubGetSnapshot, stubParseRepoUrl } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { AnalyzeJson, AnalyzeSchema, filterByTree, newId, toNode } from "@/lib/schemas";
import type { CodeMap } from "@/lib/types";

// Owner (Josiah). SEAMS for Sebastian's files: stubParseRepoUrl/stubGetSnapshot -> github.ts,
// saveMockMap -> db.saveMap. Swap the imports; the logic below doesn't change.
const REAL = true;

export async function POST(req: Request) {
  if (isMock() || !REAL) return NextResponse.json({ map: mockAnalyze() });

  try {
    const { repoUrl } = (await req.json()) as { repoUrl?: string };
    if (!repoUrl) return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });

    let parsed: { owner: string; name: string };
    try {
      parsed = stubParseRepoUrl(repoUrl);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    const { owner, name } = parsed;
    const snapshot = await stubGetSnapshot(owner, name);

    const result = await generateJSON(prompts.analyze(snapshot), AnalyzeJson, AnalyzeSchema);
    const ideas = filterByTree(result.ideas, snapshot.tree).slice(0, 12);
    if (ideas.length < 3) {
      return NextResponse.json({ error: "Couldn't find enough grounded ideas for this repo. Try again." }, { status: 502 });
    }

    const now = new Date().toISOString();
    const isDemo = repoUrl.trim() === "demo";
    const map: CodeMap = {
      _id: isDemo ? "demo" : newId(),
      repo: { owner, name, defaultBranch: snapshot.defaultBranch, url: `https://github.com/${owner}/${name}` },
      summary: result.summary,
      stack: result.stack,
      lastSyncedSha: snapshot.headSha,
      nodes: ideas.map((d) => toNode(d, { parentId: null, origin: "analyze" })),
      events: [{ at: now, kind: "analyze", text: `Analyzed ${name} and found ${ideas.length} ideas` }],
      createdAt: now,
      updatedAt: now,
    };
    return NextResponse.json({ map: saveMockMap(map) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
