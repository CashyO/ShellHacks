import { NextResponse } from "next/server";
import { getMockMap, isMock, mockPatch } from "@/lib/mock";
import type { NodeStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMock()) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const map = getMockMap(id);
  return map ? NextResponse.json({ map }) : NextResponse.json({ error: "Map not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!isMock()) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { nodeId, status } = (await req.json()) as { nodeId: string; status: NodeStatus };
  try {
    return NextResponse.json({ map: mockPatch(id, nodeId, status) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
