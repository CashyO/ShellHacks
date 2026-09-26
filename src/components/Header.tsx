import type { CodeMap } from "@/lib/types";

// P1 (Joeco): replace with the real header ("Watching main · synced <sha>").
export default function Header({ map }: { map: CodeMap }) {
  return (
    <header className="border-b px-4 py-3 text-sm">
      <strong>ProjectGraph</strong> · {map.repo.owner}/{map.repo.name} · synced {map.lastSyncedSha.slice(0, 7)}
    </header>
  );
}
