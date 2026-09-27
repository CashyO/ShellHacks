import type { CodeMap, IdeaNode, MapEvent, NodeStatus } from "./types";

// Map replay: rebuilds how the map grew, one frame per idea or milestone, from data the map
// already stores (node.createdAt + events). Pure functions; no API calls, no contract changes.

export interface Frame {
  at: string;
  kind: "event" | "node" | "pr" | "ship";
  nodeId?: string;
  caption: string;
  icon: string;
}

const RANK: Record<Frame["kind"], number> = { event: 0, node: 1, pr: 2, ship: 3 };
const CAPTION_KINDS: MapEvent["kind"][] = ["analyze", "commit"];

export function buildFrames(map: CodeMap): Frame[] {
  const frames: Frame[] = [];
  const nodes = map.nodes.filter((n) => n.status !== "rejected");
  for (const e of map.events) {
    if (CAPTION_KINDS.includes(e.kind)) frames.push({ at: e.at, kind: "event", caption: e.text, icon: e.kind === "analyze" ? "◎" : "●" });
    else if ((e.kind === "pr" || e.kind === "ship") && e.nodeId && nodes.some((n) => n.id === e.nodeId))
      frames.push({ at: e.at, kind: e.kind, nodeId: e.nodeId, caption: e.text, icon: e.kind === "pr" ? "⇄" : "✓" });
  }
  for (const n of nodes) {
    const caption = n.origin === "detected" ? `Detected new work: "${n.title}"` : `New idea: "${n.title}"`;
    frames.push({ at: n.createdAt, kind: "node", nodeId: n.id, caption, icon: n.origin === "detected" ? "◆" : "✿" });
  }
  // Stable sort keeps map.nodes order for ideas created in the same request.
  return frames
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.at.localeCompare(b.f.at) || RANK[a.f.kind] - RANK[b.f.kind] || a.i - b.i)
    .map(({ f }) => f);
}

/** The map as it looked after `frames[index]`. */
export function mapAtFrame(map: CodeMap, frames: Frame[], index: number): CodeMap {
  const seen = frames.slice(0, index + 1);
  const born = new Set(seen.filter((f) => f.kind === "node").map((f) => f.nodeId));
  const opened = new Set(seen.filter((f) => f.kind === "pr").map((f) => f.nodeId));
  const shipped = new Set(seen.filter((f) => f.kind === "ship").map((f) => f.nodeId));
  const hasMilestone = new Set(frames.filter((f) => f.kind === "pr" || f.kind === "ship").map((f) => f.nodeId));
  const until = frames[index]?.at ?? "";

  const statusAt = (n: IdeaNode): NodeStatus => {
    if (shipped.has(n.id)) return "shipped";
    if (opened.has(n.id)) return "pr_open";
    // No recorded milestone (e.g. detected work, seeded data): it was born in its current state.
    if (!hasMilestone.has(n.id) && n.status !== "building") return n.status;
    return "suggested";
  };

  return {
    ...map,
    nodes: map.nodes.filter((n) => born.has(n.id)).map((n) => ({ ...n, status: statusAt(n) })),
    events: map.events.filter((e) => e.at <= until),
  };
}

/** How long a frame stays on screen while playing; milestones linger so they land. */
export function frameDelay(frame: Frame): number {
  if (frame.kind === "ship") return 1600;
  if (frame.kind === "pr") return 1200;
  if (frame.kind === "event") return 900;
  return 380;
}
