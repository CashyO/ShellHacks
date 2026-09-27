import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { getMockMap, isMock, mockPatch } from "@/lib/mock";
import { getSession } from "@/lib/session";
import type { NodeStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const REAL = true;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const map = isMock() || !REAL ? getMockMap(id) : await getMap(id);
    return map ? NextResponse.json({ map }) : NextResponse.json({ error: "Map not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

interface PatchBody {
  nodeId: string;
  status?: NodeStatus;
  note?: string;           // rejection reason, shown in the activity feed
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as PatchBody;
  const { nodeId, status, note } = body;

  if (isMock() || !REAL) {
    try {
      return NextResponse.json({ map: mockPatch(id, nodeId, { status, note }) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  try {
    const map = await getMap(id);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const node = map.nodes.find((n) => n.id === nodeId);
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
    const login = getSession(req)?.login;
    const now = new Date().toISOString();

    if (status) {
      node.status = status;
      if (status === "rejected") {
        node.rejectedBy = login;
        node.rejectedNote = note?.trim() || undefined;
        map.events.push({
          at: now,
          kind: "reject",
          text: `${login ? `${login} rejected` : "Rejected"} "${node.title}"${node.rejectedNote ? `: ${node.rejectedNote}` : ""}`,
          nodeId: node.id,
        });
      }
    }

    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
