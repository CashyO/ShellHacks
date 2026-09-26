import { NextResponse } from "next/server";
import { getMockMap, isMock, mockPatch } from "@/lib/mock";
import type { NodeStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

// Owner (Sebastian): set REAL = true once the real (Mongo) path below is built. Until then this serves mock data.
const REAL = false;

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMock() && REAL) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const map = getMockMap(id);
  return map ? NextResponse.json({ map }) : NextResponse.json({ error: "Map not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMock() && REAL) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { nodeId, status } = (await req.json()) as { nodeId: string; status: NodeStatus };
  try {
    return NextResponse.json({ map: mockPatch(id, nodeId, status) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
