import type { CodeMap } from "@/lib/types";

// P2 (Julian): build the panel for every status (ARCHITECTURE §8).
// `onMapChange` receives the new map returned by any api-client call.
export default function DetailPanel({
  map,
  selectedId,
}: {
  map: CodeMap;
  selectedId: string;
  onMapChange: (map: CodeMap) => void;
}) {
  const node = map.nodes.find((n) => n.id === selectedId);
  if (!node) {
    return (
      <div className="p-4 text-sm">
        <h2 className="font-semibold">{map.repo.name}</h2>
        <p>{map.summary}</p>
      </div>
    );
  }
  return (
    <div className="p-4 text-sm">
      <h2 className="font-semibold">{node.title}</h2>
      <p>{node.description}</p>
      <p className="mt-2 text-neutral-500">{node.rationale}</p>
    </div>
  );
}
