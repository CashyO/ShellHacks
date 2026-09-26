"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { analyze } from "@/lib/api-client";

const LOADING_LINES = [
  "Reading the file tree…",
  "Reading your code…",
  "Looking for what's missing…",
  "Finding ideas grounded in your files…",
  "Almost there…",
];

export default function Landing() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setLine((l) => Math.min(l + 1, LOADING_LINES.length - 1)), 3500);
    return () => clearInterval(t);
  }, [busy]);

  async function go(url: string) {
    setBusy(true);
    setLine(0);
    setError(null);
    try {
      const map = await analyze(url);
      router.push(`/map/${map._id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 p-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">ProjectGraph</h1>
        <p className="mt-2 text-neutral-500">
          Paste a GitHub repo. Get a living map of what to build next, then turn any idea into a pull request.
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (repoUrl.trim() && !busy) go(repoUrl);
        }}
      >
        <input
          className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          disabled={busy}
          onChange={(e) => setRepoUrl(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            disabled={busy || !repoUrl.trim()}
          >
            {busy ? "Analyzing…" : "Analyze"}
          </button>
          <button
            type="button"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
            disabled={busy}
            onClick={() => go("demo")}
          >
            Try demo
          </button>
        </div>
      </form>
      {busy && (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {LOADING_LINES[line]}
        </p>
      )}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    </main>
  );
}
