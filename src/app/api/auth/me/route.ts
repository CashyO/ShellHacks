import { NextResponse } from "next/server";
import { isMock } from "@/lib/mock";
import { authConfigured, getSession } from "@/lib/session";

// What the landing page needs to decide what to show. Never returns the token.
export async function GET(req: Request) {
  const session = getSession(req);
  return NextResponse.json(
    {
      configured: authConfigured(),
      mockMode: isMock(),
      user: session ? { login: session.login, avatarUrl: session.avatarUrl } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
