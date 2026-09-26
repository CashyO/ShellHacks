import type { MapEvent } from "@/lib/types";

// P2 (Julian): newest first, with an icon per `kind`.
export default function ActivityFeed({ events }: { events: MapEvent[] }) {
  return (
    <ul className="space-y-1 p-4 text-xs">
      {[...events].reverse().map((e, i) => (
        <li key={i}>
          <span className="text-neutral-500">{e.kind}</span> {e.text}
        </li>
      ))}
    </ul>
  );
}
