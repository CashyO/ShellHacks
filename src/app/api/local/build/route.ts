import { createTwoFilesPatch } from "diff";
import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeLocalError, loadTree, localGuard } from "@/lib/local";
import * as prompts from "@/lib/prompts";
import { BuildJson, BuildSchema, isPlausiblePath } from "@/lib/schemas";
import type { FileChange } from "@/lib/types";

// POST { mapId, nodeId, files: [{ path, content | null }] } -> { map }. /api/build for local maps: the VS Code
// extension sends the idea's current files from disk (null = doesn't exist yet); Gemini writes the change
// and it's stored as node.proposal. The extension shows it as a diff in the editor and applies it on request.
export async function POST(req: Request) {
  const guard = localGuard();
  if (guard) return guard;

  const { mapId, nodeId, files = [] } = (await req.json()) as {
    mapId: string;
    nodeId: string;
    files?: { path: string; content: string | null }[];
  };
  const map = await getMap(mapId).catch(() => null);
  if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.status === "shipped") return NextResponse.json({ error: "This idea is already shipped" }, { status: 409 });

  const previousStatus = node.status === "building" ? "suggested" : node.status;
  node.status = "building";
  await saveMap(map);

  try {
    const result = await generateJSON(prompts.build({ summary: map.summary, node, files }), BuildJson, BuildSchema);
    const tree = await loadTree(mapId);
    const before = new Map(files.map((f) => [f.path, f.content]));
    const changes: FileChange[] = [];
    const patches: string[] = [];

    for (const c of result.changes) {
      const path = c.path.trim().replace(/^\.?\//, "");
      if (!isPlausiblePath(path, tree)) throw new Error(`Model tried to change an unknown path: ${path}`);
      // Only files we were given can be edited; anything else must be a brand-new file.
      if (!before.has(path) && tree.includes(path)) throw new Error(`Model tried to edit ${path}, which it wasn't given. Try again.`);
      const old = before.get(path) ?? null;
      if (old === c.newContent) continue;
      changes.push({ path, newContent: c.newContent, isNew: old === null });
      patches.push(createTwoFilesPatch(`a/${path}`, `b/${path}`, old ?? "", c.newContent, undefined, undefined, { context: 3 }));
    }
    if (changes.length === 0) throw new Error("The model returned no changes. Try again.");

    node.proposal = {
      changes,
      diff: patches.join("\n"),
      prTitle: result.prTitle,
      prBody: result.prBody,
      createdAt: new Date().toISOString(),
    };
    node.status = previousStatus;
    map.events.push({
      at: new Date().toISOString(),
      kind: "build",
      text: `Wrote a change for "${node.title}" (${changes.length} file${changes.length > 1 ? "s" : ""}); review it in VS Code`,
      nodeId: node.id,
    });
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeLocalError(e);
    node.status = previousStatus;
    map.events.push({ at: new Date().toISOString(), kind: "error", text: `Build failed for "${node.title}": ${message}`, nodeId: node.id });
    await saveMap(map).catch(() => undefined);
    return NextResponse.json({ error: message }, { status });
  }
}
