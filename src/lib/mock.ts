import type { CodeMap, IdeaDraft, IdeaNode, MapEvent, NodeStatus } from "./types";

const NOW = "2026-01-01T00:00:00.000Z";

const D: Record<string, IdeaDraft> = {
  timer: { title: "Pomodoro timer", type: "feature", effort: "S", description: "Show a countdown on each time block in the day view so a user can start a focus session from the block itself.", rationale: "blockDuration() in schedule.js already computes each block's length, so the timer only needs a tick loop and a small component.", files: ["src/schedule.js", "src/components/Timer.jsx"] },
  recur: { title: "Recurring events", type: "feature", effort: "M", description: "Let an event repeat daily, weekly, or on chosen weekdays.", rationale: "events.js stores single start/end pairs; adding a repeat rule and expanding it in the store keeps the API shape intact.", files: ["src/api/events.js", "src/store.js"] },
  drag: { title: "Drag to reschedule", type: "feature", effort: "M", description: "Drag a block to a new time slot in the calendar and save the change.", rationale: "calendar.jsx renders blocks with absolute positions already, so pointer events can map y-offset back to a time.", files: ["src/calendar.jsx", "src/store.js"] },
  conflict: { title: "Conflict detection", type: "improvement", effort: "S", description: "Warn when a new event overlaps an existing one.", rationale: "addEvent() in schedule.js never checks existing blocks for overlap.", files: ["src/schedule.js"] },
  ical: { title: "iCal export", type: "feature", effort: "M", description: "Download the schedule as an .ics file that other calendar apps can import.", rationale: "Events already carry title, start and end, which map directly onto VEVENT fields.", files: ["server/index.js", "src/api/events.js"] },
  valid: { title: "Validate POST /events", type: "security", effort: "S", description: "Reject malformed or oversized event payloads before they reach the database.", rationale: "server/index.js passes req.body straight into db.insert, so any field a client sends gets stored.", files: ["server/index.js"] },
  tz: { title: "Timezone bug", type: "fix", effort: "S", description: "Events shift by hours for users outside the server's timezone.", rationale: "parseEvent() calls new Date(raw.start) on strings without a Z suffix, which browsers read as local time.", files: ["src/schedule.js"] },
  tests: { title: "Tests for schedule.js", type: "test", effort: "S", description: "Unit tests for blockDuration, parseEvent and addEvent.", rationale: "schedule.js holds all the date math and has no tests; it's the file most likely to break silently.", files: ["src/schedule.test.js"] },
  keys: { title: "Keyboard shortcuts", type: "improvement", effort: "S", description: "N for new event, arrow keys to move between days, T to jump to today.", rationale: "calendar.jsx already has goToDay() and openNewEvent() handlers to bind keys to.", files: ["src/calendar.jsx"] },
  pause: { title: "Pause and resume", type: "feature", effort: "S", description: "Pause a running timer and pick up where it left off.", rationale: "createTimer() returns only a stop function; returning pause/resume keeps the component simple.", files: ["src/schedule.js", "src/components/Timer.jsx"] },
  notify: { title: "Notify when time is up", type: "feature", effort: "S", description: "Browser notification when a focus block ends.", rationale: "Timer's onDone callback is currently empty.", files: ["src/components/Timer.jsx"] },
  rrule: { title: "RRULE support", type: "improvement", effort: "M", description: "Store repeats in the standard RRULE format.", rationale: "Makes recurring events line up with iCal export later.", files: ["src/api/events.js"] },
  focus: { title: "Focus-time stats", type: "feature", effort: "M", description: "Weekly total of completed focus sessions.", rationale: "Completed timers can be recorded in store.js next to events.", files: ["src/store.js", "src/components/Stats.jsx"] },
  snap: { title: "Snap to 15 minutes", type: "improvement", effort: "S", description: "Round dragged blocks to the nearest quarter hour.", rationale: "Free dragging produces times like 9:07.", files: ["src/calendar.jsx"] },
};

function node(key: string, parentId: string | null, status: NodeStatus = "suggested"): IdeaNode {
  return { ...D[key], id: key, parentId, status, origin: parentId ? "expand" : "analyze", createdAt: NOW };
}

export function createMockMap(): CodeMap {
  const nodes: IdeaNode[] = [
    node("timer", null), node("recur", null), node("drag", null), node("conflict", null),
    node("ical", null), node("valid", null), node("tz", null, "shipped"), node("tests", null),
    node("keys", null), node("pause", "timer"), node("notify", "timer"), node("rrule", "recur"),
  ];
  nodes.find((n) => n.id === "tz")!.shippedCommit = "a1b2c3d";
  return {
    _id: "demo",
    repo: { owner: "projectgraph-demo", name: "chronos-scheduler", defaultBranch: "main", url: "https://github.com/projectgraph-demo/chronos-scheduler" },
    summary: "A small scheduling app with a day calendar view and an Express events API.",
    stack: ["React", "Express"],
    lastSyncedSha: "a1b2c3d",
    nodes,
    events: [{ at: NOW, kind: "analyze", text: "Analyzed chronos-scheduler and found 9 ideas" }],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

// In-memory store for MOCK_MODE; survives hot reloads via globalThis.
const g = globalThis as unknown as { __mockMaps?: Map<string, CodeMap> };
const maps = (g.__mockMaps ??= new Map<string, CodeMap>());

export const isMock = () => process.env.MOCK_MODE === "true";

export function getMockMap(id: string): CodeMap | undefined {
  if (id === "demo" && !maps.has("demo")) maps.set("demo", createMockMap());
  return maps.get(id);
}

function saveMockMap(map: CodeMap): CodeMap {
  map.updatedAt = new Date().toISOString();
  maps.set(map._id, map);
  return map;
}

function need(mapId: string, nodeId?: string) {
  const map = getMockMap(mapId);
  if (!map) throw new Error("Map not found");
  const n = nodeId ? map.nodes.find((x) => x.id === nodeId) : undefined;
  if (nodeId && !n) throw new Error("Node not found");
  return { map, n: n! };
}

const ev = (map: CodeMap, kind: MapEvent["kind"], text: string, nodeId?: string) =>
  map.events.push({ at: new Date().toISOString(), kind, text, nodeId });

export function mockAnalyze(): CodeMap {
  return saveMockMap(createMockMap());
}

export function mockPatch(
  mapId: string,
  nodeId: string,
  patch: { status?: NodeStatus; note?: string; dependsOn?: string[] },
): CodeMap {
  const { map, n } = need(mapId, nodeId);
  if (patch.status) {
    n.status = patch.status;
    if (patch.status === "rejected") {
      n.rejectedNote = patch.note?.trim() || undefined;
      ev(map, "reject", `Rejected "${n.title}"${n.rejectedNote ? `: ${n.rejectedNote}` : ""}`, n.id);
    }
  }
  if (patch.dependsOn) {
    const valid = new Set(map.nodes.map((x) => x.id));
    n.dependsOn = [...new Set(patch.dependsOn)].filter((id) => id !== n.id && valid.has(id));
    ev(map, "link", `"${n.title}" now depends on ${n.dependsOn.length} idea${n.dependsOn.length === 1 ? "" : "s"}`, n.id);
  }
  return saveMockMap(map);
}

export function mockCreateNode(
  mapId: string,
  draft: { title: string; description?: string; rationale?: string; type: IdeaDraft["type"]; effort: IdeaDraft["effort"]; files?: string[]; parentId?: string | null },
): CodeMap {
  const { map } = need(mapId);
  if (draft.parentId && !map.nodes.some((n) => n.id === draft.parentId)) throw new Error("parentId does not exist on this map");
  const n: IdeaNode = {
    title: draft.title.trim(),
    description: draft.description?.trim() || "Added by hand.",
    rationale: draft.rationale?.trim() || "Added by a teammate, not suggested by Gemini.",
    type: draft.type,
    effort: draft.effort,
    files: (draft.files ?? []).map((f) => f.trim()).filter(Boolean),
    id: crypto.randomUUID().slice(0, 8),
    parentId: draft.parentId ?? null,
    status: "suggested",
    origin: "manual",
    createdAt: new Date().toISOString(),
  };
  map.nodes.push(n);
  ev(map, "create", `Added "${n.title}" by hand`, n.id);
  return saveMockMap(map);
}

export function mockExpand(mapId: string, nodeId: string): CodeMap {
  const { map, n } = need(mapId, nodeId);
  const kids = Object.keys(D).filter((k) => !map.nodes.some((x) => x.id === k)).slice(0, 3);
  kids.forEach((k) => map.nodes.push(node(k, n.id)));
  ev(map, "expand", `Expanded "${n.title}" into ${kids.length} ideas`, n.id);
  return saveMockMap(map);
}

export function mockBuild(mapId: string, nodeId: string): CodeMap {
  const { map, n } = need(mapId, nodeId);
  const path = n.files[0] ?? "src/index.js";
  n.proposal = {
    changes: [{ path, newContent: "// mock change\n", isNew: false }],
    diff: `--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,2 @@\n // existing\n+// mock change for ${n.title}\n`,
    prTitle: `feat: ${n.title}`,
    prBody: n.description,
    createdAt: new Date().toISOString(),
  };
  ev(map, "build", `Prepared a change for "${n.title}"`, n.id);
  return saveMockMap(map);
}

export function mockPr(mapId: string, nodeId: string): CodeMap {
  const { map, n } = need(mapId, nodeId);
  if (!n.proposal) throw new Error("No proposal to open a PR from");
  const number = 13 + map.nodes.filter((x) => x.pr).length;
  n.pr = { number, url: `${map.repo.url}/pull/${number}`, branch: `projectgraph/${n.id}` };
  n.status = "pr_open";
  ev(map, "pr", `Opened PR #${number} for "${n.title}"`, n.id);
  return saveMockMap(map);
}

export function mockSync(mapId: string): { map: CodeMap; changed: boolean } {
  const { map } = need(mapId);
  const open = map.nodes.filter((x) => x.status === "pr_open");
  if (!open.length) return { map, changed: false };
  open.forEach((n) => {
    n.status = "shipped";
    n.shippedCommit = "b2c3d4e";
    ev(map, "ship", `"${n.title}" shipped in PR #${n.pr?.number}`, n.id);
  });
  return { map: saveMockMap(map), changed: true };
}
