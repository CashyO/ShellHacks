import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getMockMap, isMock, mockExpand, saveMockMap, stubGetSnapshot } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { dropDuplicateTitles, ExpandJson, ExpandSchema, filterByTree, toNode } from "@/lib/schemas";

// Owner (Josiah). SEAMS for Sebastian's files: getMockMap/saveMockMap -> db.getMap/saveMap,
// stubGetSnapshot -> github.getSnapshot.
const REAL = true;

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
    const map = getMockMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const parent = map.nodes.find((n) => n.id === nodeId);
    if (!parent) return NextResponse.json({ error: "Node not found" }, { status: 404 });

    const snapshot = await stubGetSnapshot(map.repo.owner, map.repo.name);
    const existingTitles = map.nodes.map((n) => n.title);
    const result = await generateJSON(
      prompts.expand({ summary: map.summary, tree: snapshot.tree, parent, existingTitles }),
      ExpandJson,
      ExpandSchema,
    );

    const ideas = dropDuplicateTitles(filterByTree(result.ideas, snapshot.tree), existingTitles).slice(0, 5);
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
    return NextResponse.json({ map: saveMockMap(map) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
