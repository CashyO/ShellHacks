"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { analyze } from "@/lib/api-client";

// P1 (Joeco): make this the real landing page (loading lines, error message, styling).
export default function Landing() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(url: string) {
    setBusy(true);
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">ProjectGraph</h1>
      <p className="text-neutral-500">Turn a GitHub repo into a living map of what to build next.</p>
      <input
        className="rounded border px-3 py-2"
        placeholder="https://github.com/owner/repo"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={busy || !repoUrl} onClick={() => go(repoUrl)}>
          {busy ? "Analyzing…" : "Analyze"}
        </button>
        <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={busy} onClick={() => go("demo")}>
          Try demo
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}
