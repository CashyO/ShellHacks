import { NextResponse } from "next/server";
import { appOrigin, clearCookieHeader, SESSION_COOKIE } from "@/lib/session";

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE, appOrigin(req).startsWith("https:")));
  return res;
}
