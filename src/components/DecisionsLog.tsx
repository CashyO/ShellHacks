"use client";

import type { CodeMap, IdeaNode } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Row({ node, map, onSelect }: { node: IdeaNode; map: CodeMap; onSelect: (id: string) => void }) {
  const deps = (node.dependsOn ?? []).map((id) => map.nodes.find((n) => n.id === id)?.title).filter(Boolean);
  return (
    <li className="space-y-1 border-b border-neutral-100 py-3 last:border-b-0 dark:border-neutral-900">
      <div className="flex items-baseline justify-between gap-2">
        <button className="text-left font-medium hover:underline" onClick={() => onSelect(node.id)}>
          {node.title}
        </button>
        <span className="shrink-0 text-xs text-neutral-400">{fmt(node.createdAt)}</span>
      </div>
      <p className="text-xs text-neutral-500">
        Rejected{node.rejectedBy ? ` by ${node.rejectedBy}` : ""}
        {node.rejectedNote ? `: ${node.rejectedNote}` : " — no reason given"}
      </p>
      {deps.length > 0 && <p className="text-xs text-neutral-400">Depended on: {deps.join(", ")}</p>}
    </li>
  );
}

// The decision log a team doesn't currently have anywhere: every idea that was considered and turned down,
// with who and why — not just what shipped. Rejected nodes are hidden from the graph itself (by design),
// so this is the only place that record is visible.
export default function DecisionsLog({
  map,
  onSelect,
  onClose,
}: {
  map: CodeMap;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const rejected = map.nodes
    .filter((n) => n.status === "rejected")
    .sort((a, b) => (b.rejectedNote ? 1 : 0) - (a.rejectedNote ? 1 : 0));
  const manual = map.nodes.filter((n) => n.origin === "manual").length;
  const detected = map.nodes.filter((n) => n.origin === "detected").length;

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-4 pt-16" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white shadow-xl dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div>
            <h2 className="text-sm font-semibold">Decisions</h2>
            <p className="text-xs text-neutral-500">
              What this team has already considered and said no to — grounded in code, not a Slack thread nobody can find again.
            </p>
          </div>
          <button className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="px-4 py-2">
          {rejected.length === 0 ? (
            <p className="py-6 text-center text-xs text-neutral-400">Nothing rejected yet. Decisions show up here as the team makes them.</p>
          ) : (
            <ul>
              {rejected.map((n) => (
                <Row key={n.id} node={n} map={map} onSelect={() => { onSelect(n.id); onClose(); }} />
              ))}
            </ul>
          )}
        </div>
        {(manual > 0 || detected > 0) && (
          <div className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800">
            {manual > 0 && <span>{manual} added by hand. </span>}
            {detected > 0 && <span>{detected} detected from commits, not suggested.</span>}
          </div>
        )}
      </div>
    </div>
  );
}
