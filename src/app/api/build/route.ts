import { createTwoFilesPatch } from "diff";
import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { generateJSON } from "@/lib/gemini";
import { describeError, getFiles, getRequestToken, getTree } from "@/lib/github";
import { isMock, mockBuild } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { BuildJson, BuildSchema, isPlausiblePath } from "@/lib/schemas";
import type { FileChange } from "@/lib/types";

const REAL = true;

export async function POST(req: Request) {
  const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };

  if (isMock() || !REAL) {
    try {
      return NextResponse.json({ map: mockBuild(mapId, nodeId) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  const map = await getMap(mapId).catch(() => null);
  if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.status === "pr_open" || node.status === "shipped") {
    return NextResponse.json({ error: `This idea is already ${node.status}` }, { status: 409 });
  }

  const previousStatus = node.status;
  node.status = "building";
  await saveMap(map);

  try {
    const { owner, name } = map.repo;
    const token = getRequestToken(req);
    // Fresh contents from GitHub, not from the analyze-time snapshot.
    const current = await getFiles(owner, name, node.files, token);
    const result = await generateJSON(prompts.build({ summary: map.summary, node, files: current }), BuildJson, BuildSchema);

    const tree = await getTree(owner, name, token);
    const oldByPath = new Map(current.map((f) => [f.path, f.content]));
    const changes: FileChange[] = [];
    const patches: string[] = [];

    for (const c of result.changes) {
      const path = c.path.trim().replace(/^\.?\//, "");
      if (!isPlausiblePath(path, tree)) throw new Error(`Model tried to change an unknown path: ${path}`);
      let before = oldByPath.get(path);
      if (before === undefined) before = (await getFiles(owner, name, [path], token))[0].content;
      const isNew = before === null;
      if (!isNew && before === c.newContent) continue;
      changes.push({ path, newContent: c.newContent, isNew });
      patches.push(createTwoFilesPatch(`a/${path}`, `b/${path}`, before ?? "", c.newContent, undefined, undefined, { context: 3 }));
    }
    if (changes.length === 0) throw new Error("The model returned no changes. Try again.");

    node.proposal = {
      changes,
      diff: patches.join("\n"),
      prTitle: result.prTitle,
      prBody: result.prBody,
      createdAt: new Date().toISOString(),
    };
    node.status = "suggested";
    map.events.push({
      at: new Date().toISOString(),
      kind: "build",
      text: `Prepared a change for "${node.title}" (${changes.length} file${changes.length > 1 ? "s" : ""})`,
      nodeId: node.id,
    });
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeError(e);
    node.status = previousStatus;
    map.events.push({ at: new Date().toISOString(), kind: "error", text: `Build failed for "${node.title}": ${message}`, nodeId: node.id });
    await saveMap(map).catch(() => undefined);
    return NextResponse.json({ error: message }, { status });
  }
}
