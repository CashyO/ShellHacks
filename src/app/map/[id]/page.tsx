"use client";

import { use, useEffect, useState } from "react";
import ActivityFeed from "@/components/ActivityFeed";
import DetailPanel from "@/components/DetailPanel";
import Graph from "@/components/Graph";
import Header from "@/components/Header";
import Legend from "@/components/Legend";
import { getMap } from "@/lib/api-client";
import type { CodeMap } from "@/lib/types";

// P1 (Joeco): owns this layout. State rule: one `map`; every API response replaces it.
export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [map, setMap] = useState<CodeMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("root");

  useEffect(() => {
    getMap(id).then(setMap).catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <main className="p-8">Could not load map: {error}</main>;
  if (!map) return <main className="p-8">Loading…</main>;

  return (
    <div className="flex h-screen flex-col">
      <Header map={map} />
      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1">
          <div className="absolute inset-0">
            <Graph map={map} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
          <div className="absolute bottom-3 left-3 rounded bg-white/80 px-2 py-1 dark:bg-black/60">
            <Legend />
          </div>
        </section>
        <aside className="w-[380px] overflow-auto border-l">
          <DetailPanel map={map} selectedId={selectedId} onMapChange={setMap} />
          <ActivityFeed events={map.events} />
        </aside>
      </div>
    </div>
  );
}
