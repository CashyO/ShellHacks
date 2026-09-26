import type { CodeMap, NodeStatus } from "./types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const send = <T>(method: string, url: string, body: unknown) =>
  call<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const analyze = (repoUrl: string) =>
  send<{ map: CodeMap }>("POST", "/api/analyze", { repoUrl }).then((r) => r.map);

export const getMap = (id: string) => call<{ map: CodeMap }>(`/api/maps/${id}`).then((r) => r.map);

export const setNodeStatus = (mapId: string, nodeId: string, status: NodeStatus) =>
  send<{ map: CodeMap }>("PATCH", `/api/maps/${mapId}`, { nodeId, status }).then((r) => r.map);

export const expandNode = (mapId: string, nodeId: string) =>
  send<{ map: CodeMap }>("POST", "/api/expand", { mapId, nodeId }).then((r) => r.map);

export const buildNode = (mapId: string, nodeId: string) =>
  send<{ map: CodeMap }>("POST", "/api/build", { mapId, nodeId }).then((r) => r.map);

export const openPr = (mapId: string, nodeId: string) =>
  send<{ map: CodeMap }>("POST", "/api/pr", { mapId, nodeId }).then((r) => r.map);

export const syncMap = (mapId: string) =>
  send<{ map: CodeMap; changed: boolean }>("POST", "/api/sync", { mapId });
