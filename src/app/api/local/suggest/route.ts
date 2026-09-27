import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeLocalError, loadTree, localGuard, saveTree } from "@/lib/local";
import { dropDuplicateTitles, filterByTree, toNode } from "@/lib/schemas";
import { type Focus, suggestPrompt, SuggestJson, SuggestSchema } from "@/lib/suggest";

const MAX_DIFF_CHARS = 16_000;
const MAX_SNIPPET_CHARS = 6_000;

// POST { mapId, diff, focus?, tree? } -> { map, added: string[], thought }. The passive agent: called by
// the VS Code extension while the developer codes, with what they're looking at and their uncommitted
// changes; sprouts 0-2 ideas for that moment.
export async function POST(req: Request) {
  const guard = localGuard();
  if (guard) return guard;

  try {
    const body = (await req.json()) as { mapId: string; diff?: string; focus?: Focus; tree?: string[] };
    const { mapId, focus, tree: sentTree } = body;
    const diff = (body.diff ?? "").slice(0, MAX_DIFF_CHARS);
    if (!mapId) return NextResponse.json({ error: "mapId is required" }, { status: 400 });
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    if (!diff.trim() && !focus) return NextResponse.json({ map, added: [], thought: "" });
    if (focus) {
      focus.snippet = focus.snippet.slice(0, MAX_SNIPPET_CHARS);
      focus.selection = focus.selection?.slice(0, 2000);
    }
    if (sentTree?.length) await saveTree(mapId, sentTree);
    const tree = sentTree?.length ? sentTree : await loadTree(mapId);

    const live = map.nodes.filter((n) => n.status !== "rejected");
    const result = await generateJSON(
      suggestPrompt({ summary: map.summary, diff, focus, nodes: live, tree }),
      SuggestJson,
      SuggestSchema,
    );

    const added: string[] = [];
    for (const s of result.ideas.slice(0, 2)) {
      const [d] = dropDuplicateTitles(filterByTree([s.idea], tree), map.nodes.map((n) => n.title));
      if (!d) continue;
      const parentId = live.some((n) => n.id === s.parentId) ? s.parentId : null;
      const node = toNode(d, { parentId, origin: "sync" });
      map.nodes.push(node);
      added.push(node.id);
      map.events.push({ at: node.createdAt, kind: "sprout", text: `Agent pitched: "${node.title}"`, nodeId: node.id });
    }
    const saved = added.length ? await saveMap(map) : map;
    return NextResponse.json({ map: saved, added, thought: result.thought });
  } catch (e) {
    const { status, message } = describeLocalError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
