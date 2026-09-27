import type { CodeMap } from "./types";

// Browser-safe helpers for local-repo maps (created by the VS Code extension; see src/lib/local.ts).

export const LOCAL_OWNER = "local";
export const isLocalMap = (map: Pick<CodeMap, "repo">) => map.repo.owner === LOCAL_OWNER;

export async function expandLocalNode(mapId: string, nodeId: string): Promise<CodeMap> {
  const res = await fetch("/api/local/expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapId, nodeId }),
  });
  const data = (await res.json().catch(() => ({}))) as { map?: CodeMap; error?: string };
  if (!res.ok || !data.map) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data.map;
}
