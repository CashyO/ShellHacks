"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { analyze } from "@/lib/api-client";

type Spitball = {
  start: (o?: {
    color?: string;
    backdrop?: "flow" | "none";
    label?: boolean;
    labelText?: string;
    ideas?: [string, string][];
  }) => Spitball;
  progress: (p: number) => Spitball;
  done: () => Promise<void>;
  destroy: () => void;
  readonly active: boolean;
};

const spitball = () =>
  typeof window !== "undefined"
    ? (window as unknown as { SpitballLoader?: Spitball }).SpitballLoader
    : undefined;

export default function Landing() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = spitball();
    if (!loader || sessionStorage.getItem("spitball-seen")) return;

    sessionStorage.setItem("spitball-seen", "1");
    loader.start({ backdrop: "flow" });

    const finish = () => setTimeout(() => loader.done(), 1200);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
  }, []);

  async function go(url: string) {
    const loader = spitball();
    setBusy(true);
    setError(null);
    loader?.start({ labelText: "Analyzing repo" });

    try {
      const map = await analyze(url);
      await loader?.done();
      router.push(`/map/${map._id}`);
    } catch (e) {
      loader?.destroy();
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
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
    </main>
  );
}
