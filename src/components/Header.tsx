import type { CodeMap } from "@/lib/types";

export default function Header({ map, syncedAt }: { map: CodeMap; syncedAt: Date | null }) {
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2.5 text-sm dark:border-neutral-800">
      <a href="/" className="font-semibold">
        ProjectGraph
      </a>
      <span className="text-neutral-400">/</span>
      <a className="hover:underline" href={map.repo.url} target="_blank" rel="noreferrer">
        {map.repo.owner}/{map.repo.name}
      </a>
      <span className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
        Watching {map.repo.defaultBranch} · synced {map.lastSyncedSha.slice(0, 7)}
        {syncedAt ? ` · checked ${syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
      </span>
    </header>
  );
}
