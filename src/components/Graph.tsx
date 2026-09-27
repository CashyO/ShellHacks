"use client";

import dynamic from "next/dynamic";
import type { CodeMap } from "@/lib/types";

// P1 (Joeco). The canvas library needs the browser, so it loads client-only.
// The actual drawing lives in GraphCanvas.tsx (next/dynamic can't forward refs).
const GraphCanvas = dynamic(() => import("./GraphCanvas"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-neutral-500">Loading graph…</div>,
});

export default function Graph(props: {
  map: CodeMap;
  selectedId: string;
  onSelect: (id: string) => void;
  focusFile?: string;
}) {
  return <GraphCanvas {...props} />;
}
