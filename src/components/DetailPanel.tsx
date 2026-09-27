"use client";

import { useEffect, useState } from "react";
import { buildNode, expandNode, openPr, setNodeStatus } from "@/lib/api-client";
import type { CodeMap, IdeaNode, NodeStatus, NodeType } from "@/lib/types";
import { expandLocalNode, isLocalMap } from "@/lib/local-client";
import DiffView from "./DiffView";

const TYPE_COLOR: Record<NodeType, string> = {
  feature: "#2E6BE6",
  improvement: "#7B4ED8",
  fix: "#C27C06",
  security: "#D23C35",
  test: "#0C8585",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  suggested: "Suggested",
  building: "Building…",
  pr_open: "PR open",
  shipped: "Shipped",
  rejected: "Rejected",
};

/** Legacy copy via a hidden textarea; works in some embedded pages where the Clipboard API is refused. */
function execCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}

/** Inside the VS Code extension, ask it to copy with VS Code's own clipboard; resolves true once it confirms. */
function copyViaVsCode(text: string): Promise<boolean> {
  if (window.parent === window) return Promise.resolve(false);
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent || e.data?.type !== "projectgraph:copied") return;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(true);
    };
    // No reply (e.g. Simple Browser or another embedder) means nobody copied it.
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, 800);
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "projectgraph:copy", text }, "*");
  });
}

// The async Clipboard API can be refused (unfocused document, permission policy, embedded frames such as
// VS Code webviews), so fall back instead of failing silently.
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return execCopy(text) || (await copyViaVsCode(text));
  }
}

function copyPrompt(map: CodeMap, node: IdeaNode) {
  const repo = isLocalMap(map) ? `this repo, ${map.repo.name}` : `the repo ${map.repo.owner}/${map.repo.name}`;
  const text = [
    `In ${repo} (${map.summary}), implement: ${node.title}.`,
    "",
    node.description,
    "",
    `Why: ${node.rationale}`,
    `Files: ${node.files.join(", ")}`,
    "",
    "Keep the change small and focused, and match the existing code style.",
  ].join("\n");
  return copyText(text);
}

// The extension's "hello" arrives once, right after the page loads; keep it across DetailPanel remounts
// (the panel is re-keyed on every selection).
let vsCodeFeatures: string[] | null = null;
if (typeof window !== "undefined" && window.parent !== window) {
  window.addEventListener("message", (e) => {
    if (e.source === window.parent && e.data?.type === "projectgraph:hello" && Array.isArray(e.data.features)) {
      vsCodeFeatures = e.data.features;
    }
  });
}

const btn =
  "rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${btn} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-300`;
const secondary = `${btn} border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800`;

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />;
}

export default function DetailPanel({
  map,
  selectedId,
  onMapChange,
  onBusyChange,
}: {
  map: CodeMap;
  selectedId: string;
  onMapChange: (map: CodeMap) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const node = map.nodes.find((n) => n.id === selectedId);
  // Local maps come from the VS Code extension: no GitHub, so no Build/PR, and file chips open in the editor.
  const local = isLocalMap(map);
  const embedded = typeof window !== "undefined" && window.parent !== window;
  const toVsCode = (msg: object) => window.parent.postMessage(msg, "*");
  const openInEditor = (path: string) => toVsCode({ type: "projectgraph:openFile", path });
  // Build progress for this idea, reported by the VS Code extension (building → review → applied).
  const [vsBuild, setVsBuild] = useState<{ state: string; message: string } | null>(null);
  // What the running extension supports (null = it hasn't said, i.e. an older build that predates the handshake).
  const [vsFeatures, setVsFeatures] = useState<string[] | null>(() => vsCodeFeatures);
  const outdated = (feature: string) => local && embedded && !vsFeatures?.includes(feature);
  const needReload = () =>
    setError("Your ProjectGraph extension is out of date. In VS Code run “Developer: Reload Window” (or install the latest .vsix), then try again.");

  useEffect(() => {
    if (!local || window.parent === window) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      if (e.data?.type === "projectgraph:hello" && Array.isArray(e.data.features)) setVsFeatures(e.data.features);
      if (e.data?.type === "projectgraph:openResult" && e.data.nodeId === selectedId && Array.isArray(e.data.missing)) {
        const missing = e.data.missing as string[];
        const opened = Number(e.data.opened) || 0;
        setVsBuild(
          missing.length
            ? {
                state: "info",
                message: `${missing.join(", ")} ${missing.length > 1 ? "don't" : "doesn't"} exist yet${opened ? ` (opened the other ${opened})` : ""}. Build it to create ${missing.length > 1 ? "them" : "it"}.`,
              }
            : { state: "info", message: `Opened ${opened} file${opened === 1 ? "" : "s"} in the editor.` },
        );
      }
      if (e.data?.type !== "projectgraph:buildStatus" || e.data.nodeId !== selectedId) return;
      setVsBuild({ state: String(e.data.state), message: String(e.data.message ?? "") });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [local, selectedId]);

  async function run(label: string, fn: () => Promise<CodeMap>) {
    setBusy(label);
    setError(null);
    onBusyChange?.(true);
    try {
      onMapChange(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      onBusyChange?.(false);
    }
  }

  if (!node) {
    const ideas = map.nodes.filter((n) => n.status !== "rejected");
    const shipped = ideas.filter((n) => n.status === "shipped").length;
    const prs = ideas.filter((n) => n.status === "pr_open").length;
    return (
      <div className="space-y-3 p-4 text-sm">
        <div>
          <h2 className="text-base font-semibold">{map.repo.name}</h2>
          {local ? (
            <span className="text-xs text-neutral-500">Local repo · {map.repo.defaultBranch}</span>
          ) : (
            <a className="text-xs text-blue-600 hover:underline" href={map.repo.url} target="_blank" rel="noreferrer">
              {map.repo.owner}/{map.repo.name} ↗
            </a>
          )}
        </div>
        <p>{map.summary}</p>
        <div className="flex flex-wrap gap-1">
          {map.stack.map((s) => (
            <span key={s} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
              {s}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Ideas", ideas.length],
            ["PRs open", prs],
            ["Shipped", shipped],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-800">
              <div className="text-lg font-semibold">{n}</div>
              <div className="text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500">Click an idea on the map to explore it.</p>
      </div>
    );
  }

  const building = node.status === "building" || busy === "build" || vsBuild?.state === "building";
  const showProposal = node.proposal && !dismissed.has(node.id) && node.status !== "shipped";

  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full px-2 py-0.5 font-medium text-white" style={{ background: TYPE_COLOR[node.type] }}>
          {node.type}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">effort {node.effort}</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{STATUS_LABEL[node.status]}</span>
      </div>

      <h2 className="text-base font-semibold">{node.title}</h2>
      <p>{node.description}</p>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why this fits your code</div>
        <p className="mt-1 text-neutral-700 dark:text-neutral-300">{node.rationale}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {node.files.map((f) =>
          local && embedded ? (
            <button
              key={f}
              onClick={() => openInEditor(f)}
              title="Open in VS Code"
              className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-blue-400 dark:hover:bg-neutral-700"
            >
              {f}
            </button>
          ) : (
            <code key={f} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
              {f}
            </code>
          ),
        )}
      </div>

      {local && !embedded && node.status !== "shipped" && (
        <p className="text-xs text-neutral-500">Open this map in VS Code to build it. The map updates when you commit.</p>
      )}
      {local && vsBuild?.message && vsBuild.state !== "building" && (
        <p
          className={
            vsBuild.state === "error"
              ? "rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
              : "rounded-md bg-cyan-50 p-2 text-xs text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"
          }
        >
          {vsBuild.state === "applied" ? "✓ " : ""}
          {vsBuild.message}
        </p>
      )}

      {error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}

      {building && (
        <p className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <Spinner /> Writing the change… this can take up to a minute.
        </p>
      )}

      {showProposal && node.proposal && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Proposed change · {node.proposal.changes.length} file{node.proposal.changes.length > 1 ? "s" : ""}
          </div>
          <div className="font-medium">{node.proposal.prTitle}</div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">{node.proposal.prBody}</p>
          <DiffView diff={node.proposal.diff} />
        </div>
      )}

      {node.status === "pr_open" && node.pr && (
        <p>
          <a className="font-medium text-blue-600 hover:underline" href={node.pr.url} target="_blank" rel="noreferrer">
            PR #{node.pr.number} on GitHub ↗
          </a>
          <span className="ml-2 text-xs text-neutral-500">{node.pr.branch}</span>
        </p>
      )}

      {node.status === "shipped" && (
        <p className="text-green-700 dark:text-green-400">
          ✓ Shipped{node.shippedCommit ? ` in ${node.shippedCommit.slice(0, 7)}` : ""}
          {node.origin === "detected" ? " (detected from your commits)" : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {local && embedded && node.status !== "shipped" && !building && (
          <>
            {node.proposal ? (
              <>
                <button className={primary} onClick={() => (outdated("review") ? needReload() : toVsCode({ type: "projectgraph:review", nodeId: node.id }))}>
                  Review in VS Code
                </button>
                <button className={secondary} onClick={() => (outdated("build") ? needReload() : toVsCode({ type: "projectgraph:build", nodeId: node.id }))}>
                  Rebuild
                </button>
              </>
            ) : (
              <button className={primary} onClick={() => (outdated("build") ? needReload() : toVsCode({ type: "projectgraph:build", nodeId: node.id }))}>
                Build it
              </button>
            )}
          </>
        )}
        {local && embedded && (
          <button
            className={secondary}
            onClick={() => (outdated("openFiles") ? needReload() : toVsCode({ type: "projectgraph:openFiles", nodeId: node.id, paths: node.files }))}
          >
            Open files
          </button>
        )}
        {node.status === "suggested" && !building && !local && (
          <>
            {showProposal ? (
              <>
                <button className={primary} disabled={!!busy} onClick={() => run("pr", () => openPr(map._id, node.id))}>
                  {busy === "pr" ? <Spinner /> : "Open PR"}
                </button>
                <button className={secondary} disabled={!!busy} onClick={() => setDismissed(new Set(dismissed).add(node.id))}>
                  Discard
                </button>
              </>
            ) : (
              <button className={primary} disabled={!!busy} onClick={() => run("build", () => buildNode(map._id, node.id))}>
                Build it
              </button>
            )}
          </>
        )}
        {node.status !== "building" && (
          <button className={secondary} disabled={!!busy} onClick={() => run("expand", () => (local ? expandLocalNode : expandNode)(map._id, node.id))}>
            {busy === "expand" ? (
              <>
                <Spinner /> Expanding…
              </>
            ) : (
              "Expand"
            )}
          </button>
        )}
        <button
          className={secondary}
          onClick={() =>
            copyPrompt(map, node).then((ok) => {
              setCopied(ok ? "copied" : "failed");
              setTimeout(() => setCopied("idle"), 1500);
            })
          }
        >
          {copied === "copied" ? "Copied!" : copied === "failed" ? "Copy failed" : "Copy prompt"}
        </button>
        {node.status === "suggested" && !building && (
          <button className={`${secondary} text-neutral-500`} disabled={!!busy} onClick={() => run("reject", () => setNodeStatus(map._id, node.id, "rejected"))}>
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
