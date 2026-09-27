"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import ActivityFeed from "@/components/ActivityFeed";
import AgentPulse, { type AgentState } from "@/components/AgentPulse";
import BuildSelectedPanel from "@/components/BuildSelectedPanel";
import DecisionsLog from "@/components/DecisionsLog";
import DetailPanel from "@/components/DetailPanel";
import Graph from "@/components/Graph";
import Header from "@/components/Header";
import Legend from "@/components/Legend";
import ReplayBar from "@/components/ReplayBar";
import { getMap, syncMap } from "@/lib/api-client";
import { isLocalMap } from "@/lib/local-client";
import { buildFrames, mapAtFrame } from "@/lib/replay";
import type { CodeMap } from "@/lib/types";

const SYNC_MS = 20_000;
const LOCAL_REFRESH_MS = 5_000;

// One `map` in state; every API response replaces it. Polls /api/sync while the page is open.
export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [map, setMap] = useState<CodeMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("root");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const busyRef = useRef(false);
  const [replayIndex, setReplayIndex] = useState<number | null>(null); // null = live
  const frames = useMemo(() => (map ? buildFrames(map) : []), [map]);
  // A sync mid-replay can shrink `frames`; clamp so the index never points past the end.
  const replayAt = replayIndex === null || frames.length < 2 ? null : Math.min(replayIndex, frames.length - 1);
  const shown = useMemo(
    () => (map && replayAt !== null ? mapAtFrame(map, frames, replayAt) : map),
    [map, frames, replayAt],
  );
  const [agent, setAgent] = useState<AgentState | null>(null); // set only when embedded by the VS Code extension
  const [narrow, setNarrow] = useState(false); // docked beside code: details slide over the map
  const [drawer, setDrawer] = useState(false);
  const [showDecisions, setShowDecisions] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const select = (nodeId: string) => {
    setSelectedId(nodeId);
    if (nodeId !== "root") setDrawer(true);
    else setMultiSelected(new Set()); // clicking the background/root clears a multi-selection too
  };
  const toggleMulti = (nodeId: string) =>
    setMultiSelected((prev) => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });

  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < 900);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => setMultiSelected(new Set()), [id]);

  useEffect(() => {
    getMap(id)
      .then((m) => {
        setMap(m);
        const sel = new URLSearchParams(window.location.search).get("select"); // deep link: /map/<id>?select=<nodeId>
        if (sel && m.nodes.some((n) => n.id === sel)) setSelectedId(sel);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  // Local maps are synced by the VS Code extension; just re-read them so any viewer (sidebar, Simple Browser,
  // a normal tab) picks up new commits and pitched ideas.
  useEffect(() => {
    if (!map || !isLocalMap(map)) return;
    const timer = setInterval(() => {
      if (busyRef.current || document.hidden) return;
      getMap(id)
        .then((m) => setMap((prev) => (prev && m.updatedAt <= prev.updatedAt ? prev : m)))
        .catch(() => {});
    }, LOCAL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [id, map === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!map || isLocalMap(map)) return;
    const timer = setInterval(async () => {
      if (busyRef.current || document.hidden) return; // pause during build/PR requests
      try {
        const res = await syncMap(id);
        setSyncedAt(new Date());
        if (res.changed && !busyRef.current) {
          setMap((prev) => (prev && res.map.updatedAt < prev.updatedAt ? prev : res.map));
        }
      } catch {
        // polling failures are silent; the next tick retries
      }
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [id, map === null]); // eslint-disable-line react-hooks/exhaustive-deps

  // VS Code bridge: when embedded by the extension, take live agent state and reload requests.
  useEffect(() => {
    if (window.parent === window) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      if (e.data?.type === "projectgraph:agent") setAgent(e.data.agent as AgentState);
      if (e.data?.type !== "projectgraph:refresh") return;
      const pick = typeof e.data.select === "string" ? e.data.select : null;
      getMap(id)
        .then((m) => {
          setMap((prev) => (prev && m.updatedAt < prev.updatedAt ? prev : m));
          if (pick && m.nodes.some((n) => n.id === pick)) setSelectedId(pick);
        })
        .catch(() => {});
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "projectgraph:ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-8">
        <h1 className="text-lg font-semibold">Could not load this map</h1>
        <p className="mt-2 text-sm text-neutral-600">{error}</p>
        <a className="mt-4 inline-block text-sm text-blue-600 hover:underline" href="/">
          ← Back to start
        </a>
      </main>
    );
  }
  if (!map || !shown) return <main className="p-8 text-sm text-neutral-500">Loading map…</main>;

  return (
    <div className="flex h-screen flex-col">
      <Header map={map} syncedAt={syncedAt} onOpenDecisions={() => setShowDecisions(true)} />
      {showDecisions && (
        <DecisionsLog
          map={map}
          onSelect={(nodeId) => select(nodeId)}
          onClose={() => setShowDecisions(false)}
        />
      )}
      <div className="relative flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <Graph
              map={shown}
              selectedId={selectedId}
              onSelect={select}
              focusFile={agent?.focus?.file}
              multiSelected={multiSelected}
              onToggleMultiSelect={toggleMulti}
            />
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded bg-white/80 px-2 py-1 dark:bg-black/60">
            <Legend />
            <span className="text-xs text-neutral-400">Ctrl/⌘-click to select multiple, then build them together</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <div className="flex w-full max-w-[560px] justify-center">
              <ReplayBar frames={frames} index={replayAt} onChange={setReplayIndex} />
            </div>
          </div>
          {agent && (
            <div className="pointer-events-none absolute bottom-3 right-3 z-10">
              <AgentPulse agent={agent} map={map} onSelect={select} onMapChange={setMap} />
            </div>
          )}
          {multiSelected.size >= 2 && (
            <BuildSelectedPanel
              map={map}
              selected={[...multiSelected].map((mid) => map.nodes.find((n) => n.id === mid)).filter((n) => !!n)}
              onMapChange={setMap}
              onDone={() => setMultiSelected(new Set())}
            />
          )}
          {narrow && !drawer && (
            <button
              onClick={() => setDrawer(true)}
              className="absolute right-3 top-3 z-10 rounded-full border border-neutral-300 bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm dark:border-neutral-700 dark:bg-neutral-900/90"
            >
              Details
            </button>
          )}
        </section>
        <aside
          className={
            narrow
              ? `${drawer ? "" : "hidden"} absolute inset-y-0 right-0 z-20 w-[min(360px,90vw)] overflow-auto border-l border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950`
              : "w-[380px] shrink-0 overflow-auto border-l border-neutral-200 dark:border-neutral-800"
          }
        >
          {narrow && (
            <button onClick={() => setDrawer(false)} className="sticky top-0 z-10 ml-auto block px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              ✕
            </button>
          )}
          <DetailPanel
            key={selectedId}
            map={map}
            selectedId={selectedId}
            onMapChange={setMap}
            onBusyChange={(b) => (busyRef.current = b)}
          />
          <ActivityFeed events={shown.events} />
        </aside>
      </div>
    </div>
  );
}
