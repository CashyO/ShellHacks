import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { getMockMap, isMock, mockPatch } from "@/lib/mock";
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

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { nodeId, status } = (await req.json()) as { nodeId: string; status: NodeStatus };
  try {
    if (isMock() || !REAL) return NextResponse.json({ map: mockPatch(id, nodeId, status) });
    const map = await getMap(id);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    const node = map.nodes.find((n) => n.id === nodeId);
    if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });
    node.status = status;
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
