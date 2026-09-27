"use client";

import { use, useEffect, useRef, useState } from "react";
import ActivityFeed from "@/components/ActivityFeed";
import DetailPanel from "@/components/DetailPanel";
import Graph from "@/components/Graph";
import Header from "@/components/Header";
import Legend from "@/components/Legend";
import { getMap, syncMap } from "@/lib/api-client";
import type { CodeMap } from "@/lib/types";

const SYNC_MS = 20_000;

// One `map` in state; every API response replaces it. Polls /api/sync while the page is open.
export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [map, setMap] = useState<CodeMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("root");
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    getMap(id)
      .then((m) => {
        setMap(m);
        const sel = new URLSearchParams(window.location.search).get("select"); // deep link: /map/<id>?select=<nodeId>
        if (sel && m.nodes.some((n) => n.id === sel)) setSelectedId(sel);
      })
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (!map) return;
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
  if (!map) return <main className="p-8 text-sm text-neutral-500">Loading map…</main>;

  return (
    <div className="flex h-screen flex-col">
      <Header map={map} syncedAt={syncedAt} />
      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <Graph map={map} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 dark:bg-black/60">
            <Legend />
          </div>
        </section>
        <aside className="w-[380px] shrink-0 overflow-auto border-l border-neutral-200 dark:border-neutral-800">
          <DetailPanel
            key={selectedId}
            map={map}
            selectedId={selectedId}
            onMapChange={setMap}
            onBusyChange={(b) => (busyRef.current = b)}
          />
          <ActivityFeed events={map.events} />
        </aside>
      </div>
    </div>
  );
}
