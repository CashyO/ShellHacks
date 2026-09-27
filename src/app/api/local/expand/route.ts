import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeLocalError, loadTree, localGuard } from "@/lib/local";
import * as prompts from "@/lib/prompts";
import { dropDuplicateTitles, ExpandJson, ExpandSchema, filterByTree, toNode } from "@/lib/schemas";

// POST { mapId, nodeId } -> { map }. /api/expand for local maps: the file tree comes from the last one the
// VS Code extension sent, not from GitHub.
export async function POST(req: Request) {
  const guard = localGuard();
  if (guard) return guard;

  try {
    const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const parent = map.nodes.find((n) => n.id === nodeId);
    if (!parent) return NextResponse.json({ error: "Node not found" }, { status: 404 });

    const tree = await loadTree(mapId);
    const existingTitles = map.nodes.map((n) => n.title);
    const result = await generateJSON(
      prompts.expand({ summary: map.summary, tree, parent, existingTitles }),
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
    const { status, message } = describeLocalError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
