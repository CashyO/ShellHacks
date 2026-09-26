import { NextResponse } from "next/server";
import { isMock, mockBuild } from "@/lib/mock";

export async function POST(req: Request) {
  if (!isMock()) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };
  try {
    return NextResponse.json({ map: mockBuild(mapId, nodeId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
