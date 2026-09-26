import { NextResponse } from "next/server";
import { isMock, mockPr } from "@/lib/mock";

// Owner (Sebastian): set REAL = true once the real path below is built. Until then this serves mock data.
const REAL = false;

export async function POST(req: Request) {
  if (!isMock() && REAL) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { mapId, nodeId } = (await req.json()) as { mapId: string; nodeId: string };
  try {
    return NextResponse.json({ map: mockPr(mapId, nodeId) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
