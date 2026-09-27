"use client";

import { useState } from "react";
import { buildNode } from "@/lib/api-client";
import type { CodeMap, IdeaNode } from "@/lib/types";

type RowStatus = "pending" | "building" | "done" | "error";

const secondary =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
const primary =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300";

// Select 2+ nodes on the graph (Ctrl/Cmd-click) to build all of them without clicking Build one at a
// time. Runs one build per node in sequence, not in parallel — /api/build replaces the whole map document
// on save, so two concurrent builds on the same map would silently clobber each other's proposal.
export default function BuildSelectedPanel({
  map,
  selected,
  onMapChange,
  onDone,
}: {
  map: CodeMap;
  selected: IdeaNode[];
  onMapChange: (map: CodeMap) => void;
  onDone: () => void;
}) {
  const buildable = selected.filter((n) => n.status === "suggested");
  const skipped = selected.filter((n) => n.status !== "suggested");
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>(() => Object.fromEntries(buildable.map((n) => [n.id, "pending"])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  async function runAll() {
    setStarted(true);
    setRunning(true);
    for (const n of buildable) {
      setStatuses((s) => ({ ...s, [n.id]: "building" }));
      try {
        const m = await buildNode(map._id, n.id);
        onMapChange(m);
        setStatuses((s) => ({ ...s, [n.id]: "done" }));
      } catch (e) {
        setErrors((er) => ({ ...er, [n.id]: (e as Error).message }));
        setStatuses((s) => ({ ...s, [n.id]: "error" }));
      }
    }
    setRunning(false);
  }

  const icon: Record<RowStatus, string> = { pending: "○", building: "⟳", done: "✓", error: "✕" };
  const color: Record<RowStatus, string> = {
    pending: "text-neutral-400",
    building: "animate-spin text-blue-600",
    done: "text-green-600",
    error: "text-red-600",
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div className="w-full max-w-md space-y-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Build {buildable.length} idea{buildable.length === 1 ? "" : "s"}
          </span>
          <button className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={onDone} disabled={running}>
            ✕
          </button>
        </div>
        {skipped.length > 0 && (
          <p className="text-xs text-neutral-400">
            Skipping {skipped.length} already {skipped[0].status}: {skipped.map((n) => n.title).join(", ")}
          </p>
        )}
        <ul className="space-y-1">
          {buildable.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span className={`w-4 shrink-0 text-center ${color[statuses[n.id]]}`}>{icon[statuses[n.id]]}</span>
              <div className="flex-1">
                <div>{n.title}</div>
                {errors[n.id] && <div className="text-xs text-red-600">{errors[n.id]}</div>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 pt-1">
          {!started ? (
            <button className={primary} disabled={buildable.length === 0} onClick={runAll}>
              Build all
            </button>
          ) : (
            <button className={secondary} disabled={running} onClick={onDone}>
              {running ? "Building…" : "Done"}
            </button>
          )}
          {!started && (
            <button className={secondary} onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
