import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { compareCommits, describeError, getRequestToken, getTree } from "@/lib/github";
import { isMock, mockSync } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { dropDuplicateTitles, filterByTree, SyncJson, SyncSchema, toNode } from "@/lib/schemas";
import type { IdeaNode, MapEvent } from "@/lib/types";

const REAL = true;
const MAX_PATCH_CHARS = 30_000;

const firstLine = (s: string) => s.split("\n")[0];

export async function POST(req: Request) {
  const { mapId } = (await req.json()) as { mapId: string };

  if (isMock() || !REAL) {
    try {
      return NextResponse.json(mockSync(mapId));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  try {
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const token = getRequestToken(req);
    const { owner, name, defaultBranch } = map.repo;

    // 1. Any new commits? If not, no AI call.
    const cmp = await compareCommits(owner, name, map.lastSyncedSha, defaultBranch, token);
    if (cmp.commits.length === 0) return NextResponse.json({ map, changed: false });

    const events: MapEvent[] = [];
    const at = () => new Date().toISOString();
    const shippedNow: IdeaNode[] = [];

    // 2. Deterministic: merge commits for PRs we opened.
    for (const c of cmp.commits) {
      events.push({ at: at(), kind: "commit", text: `${c.sha.slice(0, 7)} ${firstLine(c.message)}`, sha: c.sha });
      const m = c.message.match(/Merge pull request #(\d+)/) ?? firstLine(c.message).match(/\(#(\d+)\)\s*$/);
      if (!m) continue;
      const node = map.nodes.find((n) => n.pr?.number === Number(m[1]) && n.status !== "shipped");
      if (node) {
        node.status = "shipped";
        node.shippedCommit = c.sha;
        shippedNow.push(node);
        events.push({ at: at(), kind: "ship", text: `"${node.title}" shipped (PR #${m[1]} merged)`, nodeId: node.id, sha: c.sha });
      }
    }

    // 3. One Gemini call: other shipped ideas, a detected feature, and sprouts.
    try {
      let budget = MAX_PATCH_CHARS;
      const patches = cmp.patches
        .map((p) => ({ path: p.path, patch: p.patch.slice(0, Math.max(0, Math.min(budget, 6000))) }))
        .filter((p) => {
          budget -= p.patch.length;
          return p.patch.length > 0;
        });
      const open = map.nodes.filter((n) => n.status === "suggested" || n.status === "pr_open");
      const result = await generateJSON(
        prompts.sync({
          summary: map.summary,
          commits: cmp.commits,
          patches,
          openNodes: open.map((n) => ({ id: n.id, title: n.title, files: n.files })),
          justShipped: shippedNow.map((n) => ({ id: n.id, title: n.title })),
        }),
        SyncJson,
        SyncSchema,
      );
      const tree = await getTree(owner, name, token);

      for (const id of result.shippedIds) {
        const node = open.find((n) => n.id === id);
        if (node && node.status !== "shipped") {
          node.status = "shipped";
          node.shippedCommit = cmp.headSha;
          shippedNow.push(node);
          events.push({ at: at(), kind: "ship", text: `"${node.title}" looks shipped in the new commits`, nodeId: node.id, sha: cmp.headSha });
        }
      }

      let detectedNode: IdeaNode | undefined;
      if (result.detected) {
        const [d] = dropDuplicateTitles(
          filterByTree([result.detected], tree),
          map.nodes.map((n) => n.title),
        );
        if (d) {
          detectedNode = toNode(d, { parentId: null, origin: "detected", status: "shipped" });
          detectedNode.shippedCommit = cmp.headSha;
          map.nodes.push(detectedNode);
          events.push({ at: at(), kind: "detect", text: `Detected new work: "${detectedNode.title}"`, nodeId: detectedNode.id, sha: cmp.headSha });
        }
      }

      for (const s of result.sprouts.slice(0, 3)) {
        const parentId = s.parentId === "detected" ? detectedNode?.id : map.nodes.find((n) => n.id === s.parentId)?.id;
        const [d] = dropDuplicateTitles(
          filterByTree([s.idea], tree),
          map.nodes.map((n) => n.title),
        );
        if (!parentId || !d) continue;
        const child = toNode(d, { parentId, origin: "sync" });
        map.nodes.push(child);
        events.push({ at: at(), kind: "sprout", text: `New idea sprouted: "${child.title}"`, nodeId: child.id });
      }
    } catch (e) {
      events.push({ at: at(), kind: "error", text: `Couldn't analyze new commits: ${describeError(e).message}` });
    }

    map.lastSyncedSha = cmp.headSha;
    map.events.push(...events);
    return NextResponse.json({ map: await saveMap(map), changed: true });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
