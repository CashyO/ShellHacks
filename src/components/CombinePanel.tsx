"use client";

import { useState } from "react";
import { createNode, setNodeStatus } from "@/lib/api-client";
import type { CodeMap, Effort, IdeaNode, NodeType } from "@/lib/types";

const EFFORT_ORDER: Effort[] = ["S", "M", "L"];
const TYPE_PRIORITY: NodeType[] = ["security", "fix", "feature", "improvement", "test"];

/** Deterministic starting point — no AI call. This is a "steer it yourself" tool, not a generation one. */
function mergeDraft(nodes: IdeaNode[]) {
  const title = nodes.map((n) => n.title).join(" + ").slice(0, 80);
  const description = nodes.map((n) => `${n.title}: ${n.description}`).join(" ").slice(0, 400);
  const rationale = `Combines ${nodes.length} ideas — ${nodes.map((n) => n.title).join(", ")}.`;
  const files = [...new Set(nodes.flatMap((n) => n.files))];
  const effort = EFFORT_ORDER[Math.max(...nodes.map((n) => EFFORT_ORDER.indexOf(n.effort)))];
  const counts = new Map<NodeType, number>();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const type = TYPE_PRIORITY.find((t) => counts.get(t) === maxCount) ?? nodes[0].type;
  return { title, description, rationale, files, effort, type };
}

const input = "w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700";
const primary =
  "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300";
const secondary =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

// Select 2+ nodes on the graph (Ctrl/Cmd-click) to fold them into one idea. The originals are kept as
// data — marked rejected with a note pointing at what they became — not deleted, so the Decisions log
// still explains where they went.
export default function CombinePanel({
  map,
  selected,
  onMapChange,
  onSelect,
  onDone,
}: {
  map: CodeMap;
  selected: IdeaNode[];
  onMapChange: (map: CodeMap) => void;
  onSelect: (id: string) => void;
  onDone: () => void;
}) {
  const base = mergeDraft(selected);
  const [title, setTitle] = useState(base.title);
  const [description, setDescription] = useState(base.description);
  const [type, setType] = useState<NodeType>(base.type);
  const [effort, setEffort] = useState<Effort>(base.effort);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function combine() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const combined = await createNode({
        mapId: map._id,
        title: title.trim(),
        description: description.trim() || undefined,
        rationale: base.rationale,
        type,
        effort,
        files: base.files,
        parentId: selected[0].parentId,
      });
      const newId = combined.nodes.at(-1)!.id;
      let latest = combined;
      for (const n of selected) {
        latest = await setNodeStatus(map._id, n.id, "rejected", `Combined into "${title.trim()}"`);
      }
      onMapChange(latest);
      onSelect(newId);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-4">
      <div className="w-full max-w-md space-y-2 rounded-lg border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Combine {selected.length} ideas</span>
          <button className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200" onClick={onDone} disabled={busy}>
            ✕
          </button>
        </div>
        <ul className="flex flex-wrap gap-1">
          {selected.map((n) => (
            <li key={n.id} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
              {n.title}
            </li>
          ))}
        </ul>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Combined title" />
        <textarea className={`${input} resize-none`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex gap-2">
          <select className={input} value={type} onChange={(e) => setType(e.target.value as NodeType)}>
            {(["feature", "improvement", "fix", "security", "test"] as NodeType[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className={input} value={effort} onChange={(e) => setEffort(e.target.value as Effort)}>
            {(["S", "M", "L"] as Effort[]).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-neutral-500">Files: {base.files.join(", ") || "none"}</p>
        {error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button className={primary} disabled={busy || !title.trim()} onClick={combine}>
            {busy ? "Combining…" : "Combine"}
          </button>
          <button className={secondary} disabled={busy} onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
