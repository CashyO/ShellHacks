import type { MapEvent } from "@/lib/types";

const KIND: Record<MapEvent["kind"], { icon: string; color: string }> = {
  analyze: { icon: "◎", color: "text-neutral-500" },
  expand: { icon: "＋", color: "text-purple-600" },
  build: { icon: "⚙", color: "text-blue-600" },
  pr: { icon: "⇄", color: "text-blue-600" },
  commit: { icon: "●", color: "text-neutral-500" },
  ship: { icon: "✓", color: "text-green-600" },
  sprout: { icon: "✿", color: "text-green-600" },
  detect: { icon: "◆", color: "text-amber-600" },
  error: { icon: "!", color: "text-red-600" },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// Newest first.
export default function ActivityFeed({ events }: { events: MapEvent[] }) {
  return (
    <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Activity</h3>
      <ul className="space-y-1.5 text-xs">
        {[...events].reverse().slice(0, 40).map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex gap-2">
            <span className={`w-4 shrink-0 text-center ${KIND[e.kind].color}`}>{KIND[e.kind].icon}</span>
            <span className="flex-1">{e.text}</span>
            <span className="shrink-0 text-neutral-400">{time(e.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
