import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { createPullRequest, describeError, getRequestToken } from "@/lib/github";
import { isMock, mockPr } from "@/lib/mock";

const REAL = true;
export const maxDuration = 60; // Vercel: allow long AI calls

export async function POST(req: Request) {
  const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };

  if (isMock() || !REAL) {
    try {
      return NextResponse.json({ map: mockPr(mapId, nodeId) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  try {
    const map = await getMap(mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const node = map.nodes.find((n) => n.id === nodeId);
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
    if (!node.proposal) return NextResponse.json({ error: "Build this idea first to get a proposal" }, { status: 400 });
    if (node.pr) return NextResponse.json({ map }); // already opened

    const pr = await createPullRequest({
      owner: map.repo.owner,
      name: map.repo.name,
      defaultBranch: map.repo.defaultBranch,
      nodeId: node.id,
      proposal: node.proposal,
      token: getRequestToken(req),
    });
    node.pr = pr;
    node.status = "pr_open";
    map.events.push({ at: new Date().toISOString(), kind: "pr", text: `Opened PR #${pr.number} for "${node.title}"`, nodeId: node.id });
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: message }, { status });
  }
}
