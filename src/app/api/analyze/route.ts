import { NextResponse } from "next/server";
import { saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeError, getRequestToken, getSnapshot, parseRepoUrl } from "@/lib/github";
import { isMock, mockAnalyze } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { AnalyzeJson, AnalyzeSchema, filterByTree, newMapId, toNode } from "@/lib/schemas";
import type { CodeMap } from "@/lib/types";

const REAL = true;
export const maxDuration = 60; // Vercel: allow long AI calls

export async function POST(req: Request) {
  if (isMock() || !REAL) return NextResponse.json({ map: mockAnalyze() });

  try {
    const { repoUrl } = (await req.json()) as { repoUrl?: string };
    if (!repoUrl) return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });

    const token = getRequestToken(req);
    const { owner, name } = parseRepoUrl(repoUrl);
    const snapshot = await getSnapshot(owner, name, token);

    const result = await generateJSON(prompts.analyze(snapshot), AnalyzeJson, AnalyzeSchema);
    const ideas = filterByTree(result.ideas, snapshot.tree).slice(0, 12);
    if (ideas.length < 3) {
      return NextResponse.json({ error: "Couldn't find enough grounded ideas for this repo. Try again." }, { status: 502 });
    }

    const now = new Date().toISOString();
    const map: CodeMap = {
      _id: repoUrl.trim() === "demo" ? "demo" : newMapId(),
      repo: { owner, name, defaultBranch: snapshot.defaultBranch, url: `https://github.com/${owner}/${name}` },
      summary: result.summary,
      stack: result.stack,
      lastSyncedSha: snapshot.headSha,
      nodes: ideas.map((d) => toNode(d, { parentId: null, origin: "analyze" })),
      events: [{ at: now, kind: "analyze", text: `Analyzed ${name} and found ${ideas.length} ideas` }],
      createdAt: now,
      updatedAt: now,
    };
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
