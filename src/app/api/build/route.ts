import { createTwoFilesPatch } from "diff";
import { NextResponse } from "next/server";
import { generateJSON } from "@/lib/gemini";
import { getMockMap, isMock, mockBuild, saveMockMap, stubGetFiles, stubGetSnapshot } from "@/lib/mock";
import * as prompts from "@/lib/prompts";
import { BuildJson, BuildSchema, isPlausiblePath } from "@/lib/schemas";
import type { FileChange } from "@/lib/types";

// Owner (Josiah). SEAMS for Sebastian's files: getMockMap/saveMockMap -> db.getMap/saveMap,
// stubGetFiles/stubGetSnapshot -> github.getFiles/getSnapshot (fetch files fresh, not from the snapshot).
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

  const map = getMockMap(mapId);
  if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
  if (node.status === "pr_open" || node.status === "shipped") {
    return NextResponse.json({ error: `This idea is already ${node.status}` }, { status: 409 });
  }

  const previousStatus = node.status;
  node.status = "building";
  saveMockMap(map);

  try {
    const { owner, name } = map.repo;
    const current = await stubGetFiles(owner, name, node.files);
    const result = await generateJSON(
      prompts.build({ summary: map.summary, node, files: current }),
      BuildJson,
      BuildSchema,
    );

    const tree = (await stubGetSnapshot(owner, name)).tree;
    const oldByPath = new Map(current.map((f) => [f.path, f.content]));
    const changes: FileChange[] = [];
    const patches: string[] = [];

    for (const c of result.changes) {
      const path = c.path.trim().replace(/^\.?\//, "");
      if (!isPlausiblePath(path, tree)) throw new Error(`Model tried to change an unknown path: ${path}`);
      let before = oldByPath.get(path);
      if (before === undefined) before = (await stubGetFiles(owner, name, [path]))[0].content;
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
    return NextResponse.json({ map: saveMockMap(map) });
  } catch (e) {
    node.status = previousStatus;
    map.events.push({ at: new Date().toISOString(), kind: "error", text: `Build failed for "${node.title}": ${(e as Error).message}`, nodeId: node.id });
    saveMockMap(map);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
