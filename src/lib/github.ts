import { Octokit } from "@octokit/rest";
import type { RepoSummary } from "./api-client";
import type { Snapshot } from "./prompts";
import { getSession } from "./session";
import type { Proposal } from "./types";

// Auth-ready (ARCHITECTURE §6): every function takes an optional token and falls back to GITHUB_TOKEN.
// Routes get the token only through getRequestToken(); with OAuth later, only this helper changes.
// The signed-in user's token (encrypted cookie) wins; otherwise the shared service token, if any.
export function getRequestToken(req?: Request): string | undefined {
  const session = req ? getSession(req) : null;
  return session?.token ?? (process.env.GITHUB_TOKEN || undefined);
}

export async function listUserRepos(token: string): Promise<RepoSummary[]> {
  const res = await octo(token).rest.repos.listForAuthenticatedUser({
    sort: "pushed",
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
  });
  return res.data
    .filter((r) => !r.archived)
    .map((r) => ({
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      description: r.description,
      language: r.language ?? null,
      pushedAt: r.pushed_at ?? null,
      canWrite: !!r.permissions?.push,
    }));
}

// If the shared GITHUB_TOKEN is bad (expired, mistyped), GitHub answers 401 even for public data. Retry those
// requests without credentials so public repos keep working. A signed-in user's token is never retried.
const octo = (token?: string) => {
  const auth = token ?? getRequestToken();
  const isServiceToken = !!auth && auth === process.env.GITHUB_TOKEN;
  return new Octokit({
    auth,
    userAgent: "projectgraph",
    request: isServiceToken
      ? {
          fetch: async (url: string | URL | Request, init?: RequestInit) => {
            const res = await fetch(url, init);
            if (res.status !== 401) return res;
            const headers = new Headers(init?.headers);
            headers.delete("authorization");
            return fetch(url, { ...init, headers });
          },
        }
      : undefined,
  });
};

export function parseRepoUrl(input: string): { owner: string; name: string } {
  const raw = input.trim();
  if (raw === "demo") {
    const [owner, name] = (process.env.DEMO_REPO ?? "").split("/");
    if (!owner || !name) throw new GithubError(400, "DEMO_REPO is not set (expected owner/name in .env.local).");
    return { owner, name };
  }
  const m = raw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/i);
  if (!m) throw new GithubError(400, "Enter a GitHub repo URL like https://github.com/owner/repo");
  return { owner: m[1], name: m[2] };
}

export class GithubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turns an Octokit/other error into a status + readable message for the API routes. */
export function describeError(e: unknown): { status: number; message: string } {
  if (e instanceof GithubError) return { status: e.status, message: e.message };
  const err = e as { status?: number; message?: string; response?: { headers?: Record<string, string> } };
  if (err.status === 404) return { status: 404, message: "Repo or file not found. It may be private or misspelled." };
  if (err.status === 403 || err.status === 429) {
    const remaining = err.response?.headers?.["x-ratelimit-remaining"];
    if (remaining === "0") return { status: 429, message: "GitHub rate limit reached. Add a GITHUB_TOKEN or wait a few minutes." };
    return { status: 403, message: "GitHub refused the request (permissions). The token may lack write access to this repo." };
  }
  if (err.status === 401) return { status: 401, message: "Your GitHub connection expired. Sign out and connect GitHub again." };
  return { status: err.status && err.status >= 400 ? err.status : 500, message: err.message ?? "Unexpected error" };
}

// ---------------------------------------------------------------------------
// Snapshot (analyze)
// ---------------------------------------------------------------------------

const IGNORED_DIR = /(^|\/)(node_modules|dist|build|\.next|coverage|\.git|vendor|__pycache__|\.venv|venv|out|target)\//;
const LOCKFILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|bun\.lockb?)$/;
const BINARY = /\.(png|jpe?g|gif|svg|ico|webp|avif|pdf|zip|gz|tar|mp[34]|mov|woff2?|ttf|eot|otf|map|min\.js|wasm|bin|exe|dll|so|dylib|class|jar)$/i;
const MANIFEST = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml|Gemfile|composer\.json)$/;
const SOURCE = /\.(jsx?|tsx?|py|go|rs|java|kt|rb|php|cs|c|cpp|h|swift|vue|svelte)$/i;
const MAX_FILES = 40;
const MAX_BYTES = 200 * 1024;
const MAX_FILE_BYTES = 100 * 1024;

interface TreeEntry {
  path: string;
  sha: string;
  size: number;
}

async function readTree(owner: string, name: string, token?: string) {
  const o = octo(token);
  const repo = await o.rest.repos.get({ owner, repo: name });
  const defaultBranch = repo.data.default_branch;
  const branch = await o.rest.repos.getBranch({ owner, repo: name, branch: defaultBranch });
  const headSha = branch.data.commit.sha;
  const tree = await o.rest.git.getTree({ owner, repo: name, tree_sha: headSha, recursive: "true" });
  const entries: TreeEntry[] = (tree.data.tree as { path?: string; sha?: string; size?: number; type?: string }[])
    .filter((t) => t.type === "blob" && t.path && t.sha && !IGNORED_DIR.test(t.path) && !LOCKFILE.test(t.path) && !BINARY.test(t.path))
    .map((t) => ({ path: t.path!, sha: t.sha!, size: t.size ?? 0 }));
  return { defaultBranch, headSha, entries };
}

/** Lightweight: just the path list (no file contents). */
export async function getTree(owner: string, name: string, token?: string): Promise<string[]> {
  return (await readTree(owner, name, token)).entries.map((e) => e.path).sort();
}

const score = (p: string) => {
  const depth = p.split("/").length;
  if (/^readme(\.\w+)?$/i.test(p)) return 0;
  if (MANIFEST.test(p)) return 1 + depth / 100;
  if (SOURCE.test(p)) return 2 + depth;
  return 20 + depth;
};

export async function getSnapshot(owner: string, name: string, token?: string): Promise<Snapshot> {
  const { defaultBranch, headSha, entries } = await readTree(owner, name, token);
  const picked: TreeEntry[] = [];
  let bytes = 0;
  for (const e of [...entries].filter((x) => x.size <= MAX_FILE_BYTES).sort((a, b) => score(a.path) - score(b.path) || a.path.localeCompare(b.path))) {
    if (picked.length >= MAX_FILES || bytes + e.size > MAX_BYTES) continue;
    picked.push(e);
    bytes += e.size;
  }

  const o = octo(token);
  const files: Snapshot["files"] = [];
  for (let i = 0; i < picked.length; i += 8) {
    const batch = await Promise.all(
      picked.slice(i, i + 8).map(async (e) => {
        const blob = await o.rest.git.getBlob({ owner, repo: name, file_sha: e.sha });
        return { path: e.path, content: Buffer.from(blob.data.content, "base64").toString("utf8") };
      }),
    );
    files.push(...batch);
  }
  if (files.length === 0) throw new GithubError(422, "This repo has no readable source files.");
  return { defaultBranch, headSha, tree: entries.map((e) => e.path).sort(), files };
}

/** Fresh file contents (null = file doesn't exist). */
export async function getFiles(
  owner: string,
  name: string,
  paths: string[],
  token?: string,
  ref?: string,
): Promise<{ path: string; content: string | null }[]> {
  const o = octo(token);
  return Promise.all(
    paths.map(async (path) => {
      try {
        const res = await o.rest.repos.getContent({ owner, repo: name, path, ref });
        const data = res.data as { content?: string; encoding?: string };
        if (Array.isArray(res.data) || typeof data.content !== "string") return { path, content: null };
        return { path, content: Buffer.from(data.content, "base64").toString("utf8") };
      } catch (e) {
        if ((e as { status?: number }).status === 404) return { path, content: null };
        throw e;
      }
    }),
  );
}

export async function getRepoAccess(owner: string, name: string, token?: string): Promise<{ canWrite: boolean }> {
  const repo = await octo(token).rest.repos.get({ owner, repo: name });
  return { canWrite: !!repo.data.permissions?.push };
}

// ---------------------------------------------------------------------------
// Pull request (build -> PR)
// ---------------------------------------------------------------------------

export async function createPullRequest(args: {
  owner: string;
  name: string;
  defaultBranch: string;
  nodeId: string;
  proposal: Proposal;
  token?: string;
}): Promise<{ number: number; url: string; branch: string }> {
  const { owner, name, defaultBranch, nodeId, proposal, token } = args;
  const o = octo(token);
  const branch = `projectgraph/${nodeId}`;

  const access = await getRepoAccess(owner, name, token);
  if (!access.canWrite) {
    throw new GithubError(403, "Preview only: PRs need write access to this repo. The diff and 'Copy prompt' still work.");
  }

  const base = await o.rest.git.getRef({ owner, repo: name, ref: `heads/${defaultBranch}` });
  try {
    await o.rest.git.createRef({ owner, repo: name, ref: `refs/heads/${branch}`, sha: base.data.object.sha });
  } catch (e) {
    if ((e as { status?: number }).status !== 422) throw e; // branch already exists: reuse it
  }

  for (const change of proposal.changes) {
    let sha: string | undefined;
    try {
      const existing = await o.rest.repos.getContent({ owner, repo: name, path: change.path, ref: branch });
      if (!Array.isArray(existing.data)) sha = existing.data.sha;
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
    await o.rest.repos.createOrUpdateFileContents({
      owner,
      repo: name,
      path: change.path,
      branch,
      message: `${proposal.prTitle} (${change.path})`,
      content: Buffer.from(change.newContent, "utf8").toString("base64"),
      sha,
    });
  }

  try {
    const pr = await o.rest.pulls.create({
      owner,
      repo: name,
      title: proposal.prTitle,
      head: branch,
      base: defaultBranch,
      body: `${proposal.prBody}\n\n---\nOpened by ProjectGraph.`,
    });
    return { number: pr.data.number, url: pr.data.html_url, branch };
  } catch (e) {
    if ((e as { status?: number }).status !== 422) throw e;
    const open = await o.rest.pulls.list({ owner, repo: name, head: `${owner}:${branch}`, state: "open" });
    if (open.data[0]) return { number: open.data[0].number, url: open.data[0].html_url, branch };
    throw new GithubError(422, "GitHub rejected the pull request (there may be no changes vs the base branch).");
  }
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export async function compareCommits(
  owner: string,
  name: string,
  baseSha: string,
  defaultBranch: string,
  token?: string,
): Promise<{ commits: { sha: string; message: string }[]; patches: { path: string; patch: string }[]; headSha: string }> {
  const o = octo(token);
  const cmp = await o.rest.repos.compareCommitsWithBasehead({ owner, repo: name, basehead: `${baseSha}...${defaultBranch}` });
  const commits = cmp.data.commits.map((c) => ({ sha: c.sha, message: c.commit.message }));
  const patches = (cmp.data.files ?? []).filter((f) => f.patch).map((f) => ({ path: f.filename, patch: f.patch as string }));
  const headSha = commits.at(-1)?.sha ?? baseSha;
  return { commits, patches, headSha };
}
