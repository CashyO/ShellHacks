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

/**
 * Error -> { status, message } for the local routes. They never call GitHub, so github.describeError()
 * would mislabel Gemini failures (a bad Gemini key's 401 reads as "GitHub token is invalid").
 */
export function describeLocalError(e: unknown): { status: number; message: string } {
  const err = e as { status?: number; message?: string };
  const raw = err.message ?? "Unexpected error";
  const fix = "Check .env.local and restart `npm run dev`.";
  if (err.status === 401 || /API key (not valid|expired)|API_KEY_INVALID/i.test(raw)) {
    return { status: 401, message: `Gemini rejected GEMINI_API_KEY (invalid or expired). Create a new key in Google AI Studio. ${fix}` };
  }
  if (err.status === 403) {
    return { status: 403, message: `Gemini refused the request: this key's project can't use the Gemini API (API disabled or key restricted). ${fix}` };
  }
  if (err.status === 404) {
    return { status: 404, message: `Gemini model "${process.env.GEMINI_MODEL}" wasn't found for this key. Set GEMINI_MODEL to a model id your key can use. ${fix}` };
  }
  if (err.status === 429) {
    return { status: 429, message: "Gemini quota exceeded for this key (the free tier allows very few requests). Enable billing or wait for the quota to reset." };
  }
  return { status: err.status && err.status >= 400 ? err.status : 500, message: raw };
}
