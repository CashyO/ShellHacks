import type { CodeMap } from "@/lib/types";

export default function Header({
  map,
  syncedAt,
  onOpenDecisions,
}: {
  map: CodeMap;
  syncedAt: Date | null;
  onOpenDecisions?: () => void;
}) {
  const rejectedCount = map.nodes.filter((n) => n.status === "rejected").length;
  return (
    <header className="flex items-center gap-3 border-b border-neutral-200 px-4 py-2.5 text-sm dark:border-neutral-800">
      <a href="/" className="font-semibold">
        ProjectGraph
      </a>
      <span className="text-neutral-400">/</span>
      <a className="hover:underline" href={map.repo.url} target="_blank" rel="noreferrer">
        {map.repo.owner}/{map.repo.name}
      </a>
      {onOpenDecisions && (
        <button
          className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          onClick={onOpenDecisions}
        >
          Decisions{rejectedCount > 0 ? ` (${rejectedCount})` : ""}
        </button>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
        Watching {map.repo.defaultBranch} · synced {map.lastSyncedSha.slice(0, 7)}
        {syncedAt ? ` · checked ${syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
      </span>
    </header>
  );
}
