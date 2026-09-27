import { NextResponse } from "next/server";
import { getCached, setCached } from "./db";
import { isMock } from "./mock";

// Local-repo maps: the VS Code extension reads the repo on disk and sends files, tree, commits and diffs
// to /api/local/*, so these maps never touch GitHub. They are ordinary CodeMaps with repo.owner = LOCAL_OWNER.

export { isLocalMap, LOCAL_OWNER } from "./local-client";

// The file tree is needed later (expand, post-filters) but CodeMap has no field for it, so it rides in the
// cache collection instead of changing the shared types.
const treeKey = (mapId: string) => `local-tree:${mapId}`;
export const saveTree = (mapId: string, tree: string[]) => setCached(treeKey(mapId), tree);
export const loadTree = async (mapId: string) => (await getCached<string[]>(treeKey(mapId))) ?? [];

/** Local maps need real Gemini + storage; MOCK_MODE only serves the fixture demo map. */
export const mockModeError = () =>
  NextResponse.json({ error: "Local repos need MOCK_MODE=false in .env.local (they use Gemini directly)." }, { status: 400 });

export const localGuard = () => (isMock() ? mockModeError() : null);
