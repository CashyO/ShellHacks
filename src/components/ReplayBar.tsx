"use client";

import { useEffect, useState } from "react";
import { frameDelay, type Frame } from "@/lib/replay";

// Timeline under the graph. `index === null` means live; a number shows the map at that frame.
export default function ReplayBar({
  frames,
  index,
  onChange,
}: {
  frames: Frame[];
  index: number | null;
  onChange: (index: number | null) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const last = frames.length - 1;

  useEffect(() => {
    if (!playing || index === null) return;
    if (index >= last) {
      // Hold the finished map for a beat, then hand back to the live view.
      const t = setTimeout(() => {
        setPlaying(false);
        onChange(null);
      }, 1800);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => onChange(index + 1), frameDelay(frames[index]));
    return () => clearTimeout(t);
  }, [playing, index, last, frames, onChange]);

  if (frames.length < 2) return null;

  const start = () => {
    onChange(0);
    setPlaying(true);
  };
  const exit = () => {
    setPlaying(false);
    onChange(null);
  };

  if (index === null) {
    return (
      <button
        onClick={start}
        className="pointer-events-auto rounded-full border border-neutral-300 bg-white/90 px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:hover:bg-neutral-900"
      >
        ▶ Replay how this map grew
      </button>
    );
  }

  const frame = frames[index];
  const btn = "w-7 shrink-0 rounded text-sm hover:bg-neutral-200 dark:hover:bg-neutral-800";
  return (
    <div className="pointer-events-auto w-full rounded-lg border border-neutral-300 bg-white/95 px-3 py-2 shadow-md dark:border-neutral-700 dark:bg-neutral-900/95">
      <div className="mb-1.5 flex items-center gap-2 text-xs">
        <span className="w-4 shrink-0 text-center">{frame.icon}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{frame.caption}</span>
        <span className="shrink-0 tabular-nums text-neutral-400">
          {new Date(frame.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button className={btn} onClick={() => (index >= last ? start() : setPlaying(!playing))} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            onChange(Number(e.target.value));
          }}
          className="min-w-0 flex-1 accent-green-600"
          aria-label="Replay position"
        />
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-500">
          {index + 1}/{frames.length}
        </span>
        <button className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-neutral-200 dark:text-green-400 dark:hover:bg-neutral-800" onClick={exit}>
          Live
        </button>
      </div>
    </div>
  );
}
