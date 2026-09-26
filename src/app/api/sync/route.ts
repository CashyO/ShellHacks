import { NextResponse } from "next/server";
import { isMock, mockSync } from "@/lib/mock";

export async function POST(req: Request) {
  if (!isMock()) return NextResponse.json({ error: "Not implemented" }, { status: 501 });
  const { mapId } = (await req.json()) as { mapId: string };
  try {
    return NextResponse.json(mockSync(mapId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
