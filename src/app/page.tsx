"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { analyze, getMe, listRepos, logout, type Me, type RepoSummary } from "@/lib/api-client";

const LOADING_LINES = [
  "Reading the file tree…",
  "Reading your code…",
  "Looking for what's missing…",
  "Finding ideas grounded in your files…",
  "Almost there…",
];

const ago = (iso: string | null) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
};

const primary =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300";
const secondary =
  "rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

export default function Landing() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) setError(authError);
    getMe()
      .then(setMe)
      .catch(() => setMe({ configured: false, mockMode: false, user: null }));
  }, []);

  useEffect(() => {
    if (!me?.user) return;
    listRepos()
      .then(setRepos)
      .catch((e: Error) => {
        setRepos([]);
        setError(e.message);
      });
  }, [me?.user]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)), 3500);
    return () => clearInterval(t);
  }, [busy]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
  }, [repos, query]);

  async function go(target: string, label: string) {
    setBusy(label);
    setLine(0);
    setError(null);
    try {
      const map = await analyze(target);
      router.push(`/map/${map._id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function signOut() {
    await logout();
    setRepos(null);
    setMe((m) => (m ? { ...m, user: null } : m));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-5 p-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">ProjectGraph</h1>
        <p className="mt-2 text-neutral-500">
          Connect GitHub, pick a repo, and get a living map of what to build next. Turn any idea into a pull request.
        </p>
      </div>

      {me?.mockMode && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Mock mode is on.</strong> Every repo shows the built-in sample map. Set <code>MOCK_MODE=false</code> to analyze real repos.
        </p>
      )}

      {me && !me.configured && !me.mockMode && (
        <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          <strong>GitHub sign-in isn&apos;t set up on this server yet.</strong> Missing: {(me.missing ?? []).join(", ") || "configuration"}. Add
          them to the environment and restart or redeploy. Until then you can paste a public repo URL below.
        </p>
      )}

      {busy && (
        <div className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">Analyzing {busy}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {LOADING_LINES[line]}
          </p>
        </div>
      )}

      {!busy && me === null && <p className="text-sm text-neutral-500">Loading…</p>}

      {!busy && me?.user && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={me.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
            <span>
              Signed in as <strong>{me.user.login}</strong>
            </span>
            <button className="ml-auto text-xs text-neutral-500 hover:underline" onClick={signOut}>
              Sign out
            </button>
          </div>
          <input
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            placeholder="Search your repositories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-96 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
            {repos === null && <p className="p-4 text-sm text-neutral-500">Loading your repositories…</p>}
            {repos !== null && shown.length === 0 && <p className="p-4 text-sm text-neutral-500">No repositories match.</p>}
            {shown.map((r) => (
              <button
                key={r.fullName}
                onClick={() => go(`https://github.com/${r.fullName}`, r.fullName)}
                className="flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {r.fullName}
                  {r.private && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-normal dark:bg-neutral-800">private</span>}
                  {!r.canWrite && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      preview only
                    </span>
                  )}
                  <span className="ml-auto text-xs font-normal text-neutral-400">{ago(r.pushedAt)}</span>
                </span>
                {r.description && <span className="line-clamp-1 text-xs text-neutral-500">{r.description}</span>}
                {r.language && <span className="text-xs text-neutral-400">{r.language}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {!busy && me && !me.user && me.configured && (
        <section className="space-y-3">
          <a href="/api/auth/login" className={`${primary} inline-block w-fit`}>
            Connect GitHub
          </a>
          <p className="text-xs text-neutral-500">
            We ask for the <code>repo</code> permission so we can read your code and open pull requests. You choose which repo to use.
          </p>
        </section>
      )}

      {!busy && me && !me.user && (
        <details className="text-sm" open={!me.configured}>
          <summary className="cursor-pointer text-neutral-500">{me.configured ? "Or paste a public repo URL" : "Paste a public repo URL"}</summary>
          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (repoUrl.trim()) go(repoUrl, repoUrl.trim());
            }}
          >
            <input
              className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className={primary} disabled={!repoUrl.trim()}>
                Analyze
              </button>
              <button type="button" className={secondary} onClick={() => go("demo", "the demo repo")}>
                Try demo
              </button>
            </div>
          </form>
        </details>
      )}

      {!busy && me?.user && (
        <button className="w-fit text-xs text-neutral-500 hover:underline" onClick={() => go("demo", "the demo repo")}>
          Or try the demo repo
        </button>
      )}

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    </main>
  );
}
