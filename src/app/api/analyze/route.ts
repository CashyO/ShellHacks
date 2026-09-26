import { NextResponse } from "next/server";
import { isMock, mockAnalyze } from "@/lib/mock";

// Owner (Josiah): set REAL = true once the real path below is built. Until then this serves mock data.
const REAL = false;

export async function POST() {
  if (isMock() || !REAL) return NextResponse.json({ map: mockAnalyze() });
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
