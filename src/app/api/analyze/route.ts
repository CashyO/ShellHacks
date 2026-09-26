import { NextResponse } from "next/server";
import { isMock, mockAnalyze } from "@/lib/mock";

export async function POST() {
  if (isMock()) return NextResponse.json({ map: mockAnalyze() });
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
