import { NextResponse } from "next/server";
import { appOrigin, authConfigured, cookieHeader, newState, STATE_COOKIE } from "@/lib/session";

// Sends the user to GitHub to approve access. `repo` scope = read repos and open PRs (incl. private repos).
export async function GET(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: "GitHub sign-in isn't configured (set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET)." },
      { status: 501 },
    );
  }
  const state = newState();
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${appOrigin(req)}/api/auth/callback`,
    scope: "repo",
    state,
  });
  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  res.headers.append("Set-Cookie", cookieHeader(STATE_COOKIE, state, 600, appOrigin(req).startsWith("https:")));
  return res;
}
