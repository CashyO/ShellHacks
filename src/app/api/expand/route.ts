import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeError, getConventionDocs, getRequestToken, getTree } from "@/lib/github";
import { isMock, mockExpand } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { dropDuplicateTitles, ExpandJson, ExpandSchema, filterByTree, toNode } from "@/lib/schemas";

const REAL = true;
export const maxDuration = 60; // Vercel: allow long AI calls

export async function POST(req: Request) {
  const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };

  if (isMock() || !REAL) {
    try {
      return NextResponse.json({ map: mockExpand(mapId, nodeId) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  try {
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const parent = map.nodes.find((n) => n.id === nodeId);
    if (!parent) return NextResponse.json({ error: "Node not found" }, { status: 404 });

    const token = getRequestToken(req);
    const tree = await getTree(map.repo.owner, map.repo.name, token);
    const conventions = await getConventionDocs(map.repo.owner, map.repo.name, tree, token);
    const existingTitles = map.nodes.map((n) => n.title);
    const result = await generateJSON(
      prompts.expand({ summary: map.summary, tree, parent, existingTitles, conventions }),
      ExpandJson,
      ExpandSchema,
    );

    const ideas = dropDuplicateTitles(filterByTree(result.ideas, tree), existingTitles).slice(0, 5);
    if (ideas.length === 0) {
      return NextResponse.json({ error: "No new ideas found for this node. Try another." }, { status: 502 });
    }

    for (const d of ideas) map.nodes.push(toNode(d, { parentId: parent.id, origin: "expand" }));
    map.events.push({
      at: new Date().toISOString(),
      kind: "expand",
      text: `Expanded "${parent.title}" into ${ideas.length} ideas`,
      nodeId: parent.id,
    });
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
