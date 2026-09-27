import { NextResponse } from "next/server";
import { describeError, listUserRepos } from "@/lib/github";
import { getSession } from "@/lib/session";

export const maxDuration = 30;

// The signed-in user's repos (most recently pushed first), for the repo picker.
export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Connect your GitHub account first." }, { status: 401 });
  try {
    return NextResponse.json({ repos: await listUserRepos(session.token) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const { status, message } = describeError(e);
    return NextResponse.json({ error: status === 401 ? "Your GitHub session expired. Reconnect to continue." : message }, { status });
  }
}
