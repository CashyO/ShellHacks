import type { CodeMap } from "@/lib/types";

// P1 (Joeco): replace this list with react-force-graph-2d (dynamic import, ssr:false).
// Keep the props: the map page passes them in.
export default function Graph({
  map,
  selectedId,
  onSelect,
}: {
  map: CodeMap;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="p-4">
      <button className={selectedId === "root" ? "font-bold" : ""} onClick={() => onSelect("root")}>
        {map.repo.name} (root)
      </button>
      <ul className="mt-2 space-y-1 text-sm">
        {map.nodes
          .filter((n) => n.status !== "rejected")
          .map((n) => (
            <li key={n.id}>
              <button className={selectedId === n.id ? "font-bold" : ""} onClick={() => onSelect(n.id)}>
                {n.parentId ? "↳ " : ""}
                {n.title} [{n.status}]
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
