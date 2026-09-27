"use client";

import { useState } from "react";
import { setNodeStatus } from "@/lib/api-client";
import type { CodeMap, NodeType } from "@/lib/types";

// Live panel for the passive agent. The VS Code extension streams what the developer is doing
// (see vscode-extension/extension.js); this shows it and the ideas the agent pitched for that moment.

export interface AgentState {
  state: "watching" | "thinking" | "idle";
  focus?: { file: string; symbol?: string; line: number };
  thought?: string;
  pitches: string[]; // node ids pitched this session, newest first
}

const TYPE_COLOR: Record<NodeType, string> = {
  feature: "#2E6BE6",
  improvement: "#7B4ED8",
  fix: "#C27C06",
  security: "#D23C35",
  test: "#0C8585",
};

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

export default function AgentPulse({
  agent,
  map,
  onSelect,
  onMapChange,
}: {
  agent: AgentState;
  map: CodeMap;
  onSelect: (id: string) => void;
  onMapChange: (map: CodeMap) => void;
}) {
  const [open, setOpen] = useState(true);
  const thinking = agent.state === "thinking";
  const ring = thinking ? "bg-amber-400" : "bg-emerald-400";

  const live = map.nodes.filter((n) => n.status !== "rejected");
  const relevant = agent.focus ? live.filter((n) => n.files.includes(agent.focus!.file)) : [];
  const pitches = agent.pitches
    .map((id) => live.find((n) => n.id === id))
    .filter((n) => n !== undefined)
    .slice(0, 3);

  const dismiss = async (id: string) => {
    try {
      onMapChange(await setNodeStatus(map._id, id, "rejected"));
    } catch {
      // the next refresh shows the real state
    }
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {open && (
        <div className="w-[min(300px,calc(100vw-24px))] rounded-xl border border-neutral-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Agent</span>
            <span className={thinking ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
              {thinking ? "thinking…" : "watching"}
            </span>
          </div>
          {agent.focus && (
            <div className="mt-1 truncate font-mono text-[11px] text-neutral-500" title={agent.focus.file}>
              {basename(agent.focus.file)}
              {agent.focus.symbol ? ` › ${agent.focus.symbol}` : ""} :{agent.focus.line}
            </div>
          )}
          {agent.thought && <p className="mt-2 italic text-neutral-700 dark:text-neutral-300">{agent.thought}</p>}

          {relevant.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Relevant here · {relevant.length}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {relevant.slice(0, 4).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => onSelect(n.id)}
                    className="max-w-full truncate rounded-full border border-cyan-500/60 px-2 py-0.5 hover:bg-cyan-50 dark:hover:bg-cyan-950"
                  >
                    {n.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pitches.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Pitched for you</div>
              <ul className="mt-1 space-y-1">
                {pitches.map((n) => (
                  <li key={n.id} className="flex items-start gap-2 rounded-md bg-neutral-100 p-1.5 dark:bg-neutral-900">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[n.type] }} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(n.id)}>
                      <div className="truncate font-medium">{n.title}</div>
                      <div className="line-clamp-2 text-neutral-500">{n.description}</div>
                    </button>
                    {n.status === "suggested" && (
                      <button className="shrink-0 px-1 text-neutral-400 hover:text-red-500" title="Dismiss" onClick={() => dismiss(n.id)}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!agent.thought && !pitches.length && (
            <p className="mt-2 text-neutral-500">Keep coding. Ideas appear here when you pause.</p>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        title={open ? "Hide agent" : "Show agent"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-neutral-300 bg-white shadow-md dark:border-neutral-700 dark:bg-neutral-900"
      >
        <span className={`absolute inset-0 rounded-full opacity-30 ${ring} ${thinking ? "animate-ping" : "animate-pulse"}`} />
        <span className="relative text-sm font-bold">((•))</span>
      </button>
    </div>
  );
}
