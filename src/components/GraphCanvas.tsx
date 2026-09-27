"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { CodeMap, Effort, NodeStatus, NodeType } from "@/lib/types";

const TYPE_COLOR: Record<NodeType, string> = {
  feature: "#2E6BE6",
  improvement: "#7B4ED8",
  fix: "#C27C06",
  security: "#D23C35",
  test: "#0C8585",
};
const SHIPPED = "#1C9A50";
const RADIUS: Record<Effort, number> = { S: 6, M: 8, L: 10 };
const ROOT_R = 16;

const basename = (p: string) => p.slice(p.lastIndexOf("/") + 1);

// Conflict ripple: ideas that touch any of the same files as the hovered one, with the shared paths.
function overlaps(target: GNode, nodes: GNode[]): Map<GNode, string[]> {
  const mine = new Set(target.files ?? []);
  const out = new Map<GNode, string[]>();
  if (!mine.size) return out;
  for (const n of nodes) {
    if (n === target || n.id === "root" || n.status === "shipped") continue;
    const shared = (n.files ?? []).filter((f) => mine.has(f));
    if (shared.length) out.set(n, shared);
  }
  return out;
}

interface GNode {
  id: string;
  title: string;
  type?: NodeType;
  effort?: Effort;
  status?: NodeStatus;
  parentId?: string | null;
  files?: string[];
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}
interface GLink {
  source: string;
  target: string;
}

export default function GraphCanvas({
  map,
  selectedId,
  onSelect,
  focusFile,
}: {
  map: CodeMap;
  selectedId: string;
  onSelect: (id: string) => void;
  focusFile?: string; // file open in VS Code; ideas touching it get a live ring
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined);
  const nodeCache = useRef(new Map<string, GNode>());
  const [size, setSize] = useState({ w: 600, h: 500 });
  const [dark, setDark] = useState(false);
  const ripple = useRef<{ node: GNode; related: Map<GNode, string[]> } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Reuse node objects by id so x/y survive updates; new nodes spawn at their parent.
  const graphData = useMemo(() => {
    const cache = nodeCache.current;
    const visible = map.nodes.filter((n) => n.status !== "rejected");
    const keep = new Set(["root", ...visible.map((n) => n.id)]);
    for (const id of [...cache.keys()]) if (!keep.has(id)) cache.delete(id);

    let root = cache.get("root");
    if (!root) {
      root = { id: "root", title: map.repo.name, x: 0, y: 0, fx: 0, fy: 0 };
      cache.set("root", root);
    }
    root.title = map.repo.name;

    const nodes: GNode[] = [root];
    const links: GLink[] = [];
    const topLevel = visible.filter((n) => !n.parentId);
    for (const n of visible) {
      let g = cache.get(n.id);
      if (!g) {
        const parent = (n.parentId && cache.get(n.parentId)) || root;
        // Spread new nodes outward from their parent instead of stacking them on it.
        const px = parent.x ?? 0;
        const py = parent.y ?? 0;
        const base = n.parentId
          ? Math.atan2(py, px) || 0
          : (2 * Math.PI * Math.max(0, topLevel.findIndex((t) => t.id === n.id))) / Math.max(1, topLevel.length);
        const angle = base + (n.parentId ? (Math.random() - 0.5) * 1.6 : 0);
        const dist = n.parentId ? 35 : 80;
        g = { id: n.id, title: n.title, x: px + Math.cos(angle) * dist, y: py + Math.sin(angle) * dist };
        cache.set(n.id, g);
      }
      g.title = n.title;
      g.type = n.type;
      g.effort = n.effort;
      g.status = n.status;
      g.parentId = n.parentId;
      g.files = n.files;
      nodes.push(g);
      // A parent can be missing (replay mid-way, rejected parent); hang the node off root instead of crashing.
      links.push({ source: n.parentId && keep.has(n.parentId) ? n.parentId : "root", target: n.id });
    }
    return { nodes, links };
  }, [map]);

  // Keep the hover ripple in step with the data; drop it if its node left the graph (e.g. during replay).
  useEffect(() => {
    const rip = ripple.current;
    if (!rip) return;
    ripple.current = graphData.nodes.includes(rip.node)
      ? { node: rip.node, related: overlaps(rip.node, graphData.nodes) }
      : null;
  }, [graphData]);

  useEffect(() => {
    const fg = fgRef.current;
    fg?.d3Force("charge")?.strength?.(-220);
    (fg?.d3Force("link") as { distance?: (d: number) => void } | undefined)?.distance?.(70);
  }, []);

  const fitted = useRef(false);

  const total = map.nodes.filter((n) => n.status !== "rejected").length;
  const shipped = map.nodes.filter((n) => n.status === "shipped").length;
  const ink = dark ? "#f4f4f5" : "#18181b";
  const surface = dark ? "#09090b" : "#ffffff";
  const muted = dark ? "#71717a" : "#a1a1aa";

  function drawNode(node: GNode, ctx: CanvasRenderingContext2D, scale: number) {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 350);
    const selected = node.id === selectedId;
    const rip = ripple.current;
    const inRipple = !rip || node === rip.node || rip.related.has(node);

    if (node.id === "root") {
      ctx.beginPath();
      ctx.arc(x, y, ROOT_R, 0, 2 * Math.PI);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, ROOT_R + 4, 0, 2 * Math.PI);
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (total > 0 && shipped > 0) {
        ctx.beginPath();
        ctx.arc(x, y, ROOT_R + 4, -Math.PI / 2, -Math.PI / 2 + (2 * Math.PI * shipped) / total);
        ctx.strokeStyle = SHIPPED;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.fillStyle = surface;
      ctx.font = `700 ${7}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(total ? `${Math.round((100 * shipped) / total)}%` : "", x, y);
      ctx.fillStyle = ink;
      ctx.font = `500 ${Math.max(9 / scale, 3.5)}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(node.title, x, y + ROOT_R + 9);
      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, ROOT_R + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      return;
    }

    const r = RADIUS[node.effort ?? "S"];
    const color = node.status === "shipped" ? SHIPPED : TYPE_COLOR[node.type ?? "feature"];

    ctx.save();
    if (!inRipple) ctx.globalAlpha = 0.15;
    if (focusFile && node.files?.includes(focusFile)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r + 4 + 3 * pulse, 0, 2 * Math.PI);
      ctx.strokeStyle = "#06B6D4";
      ctx.globalAlpha *= 0.35 + 0.5 * (1 - pulse);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (rip && rip.related.has(node)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r + 3 + 2.5 * pulse, 0, 2 * Math.PI);
      ctx.strokeStyle = "#E8A317";
      ctx.globalAlpha = 0.9 - 0.5 * pulse;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (node.status === "building") ctx.globalAlpha *= 0.45 + 0.55 * pulse;

    if (node.status === "pr_open") {
      ctx.beginPath();
      ctx.arc(x, y, r + 2 + 3 * pulse, 0, 2 * Math.PI);
      ctx.strokeStyle = color;
      const base = ctx.globalAlpha;
      ctx.globalAlpha = base * (0.6 * (1 - pulse) + 0.2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = base;
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (node.status === "suggested" || node.status === "building") {
      ctx.fillStyle = color;
      const base = ctx.globalAlpha;
      ctx.globalAlpha = base * 0.18;
      ctx.fill();
      ctx.globalAlpha = base;
      ctx.setLineDash([2.5, 2]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.fill();
    }
    // Checkmark, selection ring and label ignore the building pulse; only the ripple dims them.
    ctx.globalAlpha = inRipple ? 1 : 0.15;
    if (node.status === "shipped") {
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${r * 1.3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", x, y + 0.5);
    }

    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (scale > 0.6 || (rip && inRipple)) {
      ctx.fillStyle = ink;
      ctx.font = `${Math.max(9 / scale, 3.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.title, x, y + r + 4);
    }
    ctx.restore();
  }

  // Dashed "shares files" links from the hovered idea, labeled with the shared file names.
  function drawRipple(ctx: CanvasRenderingContext2D, scale: number) {
    const rip = ripple.current;
    if (!rip || !rip.related.size) return;
    const ax = rip.node.x ?? 0;
    const ay = rip.node.y ?? 0;
    const font = Math.max(8 / scale, 2.8);
    ctx.save();
    for (const [n, shared] of rip.related) {
      const bx = n.x ?? 0;
      const by = n.y ?? 0;
      ctx.beginPath();
      ctx.setLineDash([4 / scale, 3 / scale]);
      ctx.lineDashOffset = -Date.now() / 60 / scale;
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = "#E8A317";
      ctx.lineWidth = 1.6 / scale;
      ctx.stroke();

      const label = shared.map(basename).join(", ");
      ctx.font = `600 ${font}px sans-serif`;
      const w = ctx.measureText(label).width + font;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      ctx.setLineDash([]);
      ctx.fillStyle = surface;
      ctx.strokeStyle = "#E8A317";
      ctx.lineWidth = 1 / scale;
      ctx.beginPath();
      ctx.roundRect(mx - w / 2, my - font * 0.8, w, font * 1.6, font * 0.8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = dark ? "#FCD34D" : "#92400E";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    }
    const head = `⚠ Shares files with ${rip.related.size} other idea${rip.related.size === 1 ? "" : "s"}`;
    ctx.font = `600 ${font}px sans-serif`;
    ctx.fillStyle = dark ? "#FCD34D" : "#92400E";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(head, ax, ay - RADIUS[rip.node.effort ?? "S"] - 5);
    ctx.restore();
  }

  return (
    <div ref={wrapRef} className="h-full w-full">
      <ForceGraph2D<GNode, GLink>
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="rgba(0,0,0,0)"
        autoPauseRedraw={false}
        cooldownTicks={250}
        d3VelocityDecay={0.35}
        onEngineStop={() => {
          const fg = fgRef.current;
          if (!fg) return;
          if (!fitted.current) {
            fitted.current = true;
            fg.zoomToFit(400, 70);
            return;
          }
          // Refit only if the settled graph spills off-screen (sprouts, replay), so manual zoom sticks otherwise.
          const bb = fg.getGraphBbox();
          const tl = fg.graph2ScreenCoords(bb.x[0], bb.y[0]);
          const br = fg.graph2ScreenCoords(bb.x[1], bb.y[1]);
          if (tl.x < 0 || tl.y < 0 || br.x > size.w || br.y > size.h) fg.zoomToFit(400, 70);
        }}
        linkColor={() => (ripple.current ? (dark ? "#27272a" : "#e4e4e7") : muted)}
        onRenderFramePost={drawRipple}
        onNodeHover={(node) => {
          ripple.current =
            node && node.id !== "root" ? { node, related: overlaps(node, graphData.nodes) } : null;
          if (wrapRef.current) wrapRef.current.style.cursor = node ? "pointer" : "";
        }}
        linkWidth={0.8}
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          const r = node.id === "root" ? ROOT_R + 4 : RADIUS[node.effort ?? "S"] + 3;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeClick={(node) => onSelect(String(node.id))}
        onBackgroundClick={() => onSelect("root")}
      />
    </div>
  );
}
