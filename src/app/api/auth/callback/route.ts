import { NextResponse } from "next/server";
import {
  appOrigin,
  authConfigured,
  clearCookieHeader,
  cookieHeader,
  readCookie,
  seal,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/session";

// GitHub redirects here with ?code=...&state=... after the user approves.
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const secure = origin.startsWith("https:");
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(msg)}`);
    res.headers.append("Set-Cookie", clearCookieHeader(STATE_COOKIE, secure));
    return res;
  };
  if (!authConfigured()) return fail("GitHub sign-in isn't configured");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return fail("GitHub sign-in was cancelled");
  if (!code || !state || state !== readCookie(req, STATE_COOKIE)) return fail("Sign-in expired. Please try again.");

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${origin}/api/auth/callback`,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error_description?: string };
    if (!tokenData.access_token) return fail(tokenData.error_description ?? "GitHub didn't return a token");

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "projectgraph", Accept: "application/vnd.github+json" },
    });
    if (!userRes.ok) return fail("Couldn't read your GitHub profile");
    const user = (await userRes.json()) as { login: string; avatar_url: string };

    const res = NextResponse.redirect(`${origin}/`);
    res.headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, seal({ token: tokenData.access_token, login: user.login, avatarUrl: user.avatar_url }), undefined, secure));
    res.headers.append("Set-Cookie", clearCookieHeader(STATE_COOKIE, secure));
    return res;
  } catch {
    return fail("Couldn't reach GitHub. Please try again.");
  }
}
