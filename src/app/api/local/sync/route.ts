import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeError } from "@/lib/github";
import { localGuard, saveTree } from "@/lib/local";
import * as prompts from "@/lib/prompts";
import { dropDuplicateTitles, filterByTree, SyncJson, SyncSchema, toNode } from "@/lib/schemas";
import type { IdeaNode, MapEvent } from "@/lib/types";

const MAX_PATCH_CHARS = 30_000;
const firstLine = (s: string) => s.split("\n")[0];

// POST { mapId, headSha, commits, patches, tree } -> { map, changed }. The /api/sync flow for local repos:
// the extension sends each new local commit (no push needed); Gemini marks shipped ideas, detects new
// work, and sprouts follow-ups.
export async function POST(req: Request) {
  const guard = localGuard();
  if (guard) return guard;

  try {
    const { mapId, headSha, commits = [], patches = [], tree } = (await req.json()) as {
      mapId: string;
      headSha: string;
      commits?: { sha: string; message: string }[];
      patches?: { path: string; patch: string }[];
      tree?: string[];
    };
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    if (tree?.length) await saveTree(mapId, tree);
    if (!commits.length || headSha === map.lastSyncedSha) return NextResponse.json({ map, changed: false });

    const events: MapEvent[] = [];
    const at = () => new Date().toISOString();
    for (const c of commits) events.push({ at: at(), kind: "commit", text: `${c.sha.slice(0, 7)} ${firstLine(c.message)}`, sha: c.sha });

    try {
      let budget = MAX_PATCH_CHARS;
      const trimmed = patches
        .map((p) => ({ path: p.path, patch: p.patch.slice(0, Math.max(0, Math.min(budget, 6000))) }))
        .filter((p) => {
          budget -= p.patch.length;
          return p.patch.length > 0;
        });
      const open = map.nodes.filter((n) => n.status === "suggested" || n.status === "pr_open");
      const result = await generateJSON(
        prompts.sync({
          summary: map.summary,
          commits,
          patches: trimmed,
          openNodes: open.map((n) => ({ id: n.id, title: n.title, files: n.files })),
        }),
        SyncJson,
        SyncSchema,
      );
      const knownTree = tree ?? [];
      const shippedNow: IdeaNode[] = [];

      for (const id of result.shippedIds) {
        const node = open.find((n) => n.id === id);
        if (node && node.status !== "shipped") {
          node.status = "shipped";
          node.shippedCommit = headSha;
          shippedNow.push(node);
          events.push({ at: at(), kind: "ship", text: `"${node.title}" looks shipped in your commit`, nodeId: node.id, sha: headSha });
        }
      }

      let detectedNode: IdeaNode | undefined;
      if (result.detected) {
        const [d] = dropDuplicateTitles(filterByTree([result.detected], knownTree), map.nodes.map((n) => n.title));
        if (d) {
          detectedNode = toNode(d, { parentId: null, origin: "detected", status: "shipped" });
          detectedNode.shippedCommit = headSha;
          map.nodes.push(detectedNode);
          events.push({ at: at(), kind: "detect", text: `Detected new work: "${detectedNode.title}"`, nodeId: detectedNode.id, sha: headSha });
        }
      }

      for (const s of result.sprouts.slice(0, 3)) {
        const parentId = s.parentId === "detected" ? detectedNode?.id : map.nodes.find((n) => n.id === s.parentId)?.id;
        const [d] = dropDuplicateTitles(filterByTree([s.idea], knownTree), map.nodes.map((n) => n.title));
        if (!parentId || !d) continue;
        const child = toNode(d, { parentId, origin: "sync" });
        map.nodes.push(child);
        events.push({ at: at(), kind: "sprout", text: `New idea sprouted: "${child.title}"`, nodeId: child.id });
      }
    } catch (e) {
      events.push({ at: at(), kind: "error", text: `Couldn't analyze new commits: ${describeError(e).message}` });
    }

    map.lastSyncedSha = headSha;
    map.events.push(...events);
    return NextResponse.json({ map: await saveMap(map), changed: true });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
