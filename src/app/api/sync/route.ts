import { NextResponse } from "next/server";
import { isMock, mockSync } from "@/lib/mock";

// Owner (Sebastian): set REAL = true once the real path below is built. Until then this serves mock data.
const REAL = false;

export async function POST(req: Request) {
  if (!isMock() && REAL) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { mapId } = (await req.json()) as { mapId: string };
  try {
    return NextResponse.json(mockSync(mapId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
