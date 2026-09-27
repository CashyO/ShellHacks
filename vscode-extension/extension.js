// Spitball for VS Code: maps the LOCAL repo open in this window and keeps the map growing.
//  - "Map This Repository" sends a snapshot of the checkout to /api/local/analyze (no GitHub).
//  - Every local commit is sent to /api/local/sync, which ships ideas, detects work and sprouts new ones.
//  - A passive agent watches the editor (file, function under the cursor, errors, uncommitted diff) and,
//    when you pause, asks /api/local/suggest for ideas about what you're doing right now. The map, docked
//    beside your code, highlights the bubbles for your current file and shows the agent's pitches live.
// Plain JS on purpose: no dependencies and no build step.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- VS Code loads extensions as CommonJS
const vscode = require("vscode");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cp = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require("os");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const crypto = require("crypto");

const MAP_KEY = "spitball.mapId";
const HEAD_POLL_MS = 4000;

// Same snapshot rules as src/lib/github.ts, applied to the local checkout.
const IGNORED_DIR = /(^|\/)(node_modules|dist|build|\.next|coverage|\.git|vendor|__pycache__|\.venv|venv|out|target)\//;
const LOCKFILE = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock|bun\.lockb?)$/;
const BINARY = /\.(png|jpe?g|gif|svg|ico|webp|avif|pdf|zip|gz|tar|mp[34]|mov|woff2?|ttf|eot|otf|map|min\.js|wasm|bin|exe|dll|so|dylib|class|jar|vsix)$/i;
const MANIFEST = /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|Cargo\.toml|pom\.xml|Gemfile|composer\.json)$/;
const SOURCE = /\.(jsx?|tsx?|py|go|rs|java|kt|rb|php|cs|c|cpp|h|swift|vue|svelte)$/i;
const MAX_FILES = 40;
const MAX_BYTES = 200 * 1024;
const MAX_FILE_BYTES = 100 * 1024;

let ctx;
let panel; // editor tab docked beside the code
let sidebar; // "Mind Map" view in the Spitball sidebar (can be dragged to the right-hand sidebar)
let status;
let log;
let repoRoot;
let lastHead;
let lastDiffHash = "";
let lastIdeaAt = 0;
let ideaTimer;
let statusReset;
let chain = Promise.resolve();
let focusTimer;
let recentFiles = [];
// Live agent state mirrored to the map page (src/components/AgentPulse.tsx).
const agent = { state: "watching", focus: undefined, thought: "", pitches: [] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cfg = (key, def) => vscode.workspace.getConfiguration("spitball").get(key, def);
const appUrl = () => cfg("url", "http://localhost:3000").replace(/\/+$/, "");
const mapId = () => ctx.workspaceState.get(MAP_KEY);

/** Runs git; `okCodes` lets `git diff --no-index` (exit 1 = "differences found") count as success. */
function git(args, { cwd = repoRoot, okCodes = [0] } = {}) {
  return new Promise((resolve, reject) => {
    cp.execFile("git", args, { cwd, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? err.code : 0;
      if (okCodes.includes(code)) resolve(stdout);
      else reject(new Error(stderr.trim() || (err && err.message) || `git ${args[0]} failed`));
    });
  });
}

async function findRepoRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) return undefined;
  try {
    return (await git(["rev-parse", "--show-toplevel"], { cwd: folder.uri.fsPath })).trim();
  } catch {
    return undefined;
  }
}

const head = () => git(["rev-parse", "HEAD"]).then((s) => s.trim()).catch(() => "");

async function api(route, body) {
  let res;
  try {
    res = await fetch(appUrl() + route, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the Spitball app at ${appUrl()}. Start it with \`npm run dev\` or check the spitball.url setting.`);
  }
  const data = await res.json().catch(() => null);
  if (res.ok && data) return data;
  if (data && data.error) throw Object.assign(new Error(data.error), { status: res.status });
  // Every Spitball route answers in JSON, so a non-JSON 404 means the server is an older version
  // (no /api/local routes) or a different app is using that port.
  if (res.status === 404) {
    throw Object.assign(
      new Error(`${appUrl()} has no ${route.split("?")[0]} route. Update the Spitball app (git pull on main) and restart \`npm run dev\`, or check that nothing else is using that port.`),
      { status: 404 },
    );
  }
  throw Object.assign(new Error(`Request to ${route} failed (${res.status})`), { status: res.status });
}

/** Serializes background work so a commit sync and an idea request never race on the same map. */
const queue = (fn) => (chain = chain.then(fn).catch((e) => fail(e)));

function fail(e, userFacing = false) {
  log.appendLine(`[error] ${e.message}`);
  setStatus("$(warning) Spitball", e.message, 10000);
  if (userFacing) vscode.window.showErrorMessage(`Spitball: ${e.message}`);
}

function setStatus(text, tooltip, resetMs) {
  clearTimeout(statusReset);
  status.text = text;
  status.tooltip = tooltip || "Open Spitball";
  if (resetMs) statusReset = setTimeout(() => setStatus("$(type-hierarchy) Spitball"), resetMs);
}

const rel = (abs) => path.relative(repoRoot, abs).split(path.sep).join("/");
const inRepo = (doc) => doc.uri.scheme === "file" && repoRoot && !rel(doc.uri.fsPath).startsWith("..");

// ---------------------------------------------------------------------------
// Reading the local repo
// ---------------------------------------------------------------------------

/** Tracked + untracked (not ignored) files that are worth showing the model. */
async function listFiles() {
  const out = await git(["ls-files", "-co", "--exclude-standard", "-z"]);
  const files = [];
  for (const p of new Set(out.split("\0").filter(Boolean))) {
    if (IGNORED_DIR.test(p) || LOCKFILE.test(p) || BINARY.test(p)) continue;
    try {
      const st = fs.statSync(path.join(repoRoot, p));
      if (st.isFile()) files.push({ path: p, size: st.size });
    } catch {
      // tracked but deleted in the working tree
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

const score = (p) => {
  const depth = p.split("/").length;
  if (/^readme(\.\w+)?$/i.test(p)) return 0;
  if (MANIFEST.test(p)) return 1 + depth / 100;
  if (SOURCE.test(p)) return 2 + depth;
  return 20 + depth;
};

async function snapshot() {
  const entries = await listFiles();
  const picked = [];
  let bytes = 0;
  for (const e of entries.filter((x) => x.size <= MAX_FILE_BYTES).sort((a, b) => score(a.path) - score(b.path) || a.path.localeCompare(b.path))) {
    if (picked.length >= MAX_FILES || bytes + e.size > MAX_BYTES) continue;
    picked.push(e);
    bytes += e.size;
  }
  const files = picked.map((e) => ({ path: e.path, content: fs.readFileSync(path.join(repoRoot, e.path), "utf8") }));
  const branch = (await git(["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "main")).trim();
  return { name: path.basename(repoRoot), branch, headSha: await head(), tree: entries.map((e) => e.path), files };
}

/** Splits a multi-file unified diff into per-file patches. */
function splitPatches(diff) {
  return diff
    .split(/^(?=diff --git )/m)
    .filter((chunk) => chunk.startsWith("diff --git "))
    .map((chunk) => ({ path: (chunk.match(/^diff --git a\/(.+?) b\//) || [])[1] || "unknown", patch: chunk }));
}

/** Uncommitted work: saved changes vs HEAD, new untracked files, and unsaved edits in open editors. */
async function workInProgress() {
  const parts = [];
  parts.push(await git(["diff", "HEAD", "--no-color", "--no-ext-diff"]).catch(() => ""));

  const untracked = (await git(["ls-files", "--others", "--exclude-standard", "-z"]).catch(() => ""))
    .split("\0")
    .filter((p) => p && !IGNORED_DIR.test(p) && !LOCKFILE.test(p) && !BINARY.test(p))
    .slice(0, 3);
  for (const p of untracked) {
    try {
      parts.push(`=== new file: ${p} ===\n${fs.readFileSync(path.join(repoRoot, p), "utf8").slice(0, 4000)}`);
    } catch {
      // unreadable; skip
    }
  }

  for (const doc of vscode.workspace.textDocuments) {
    if (!doc.isDirty || !inRepo(doc) || !fs.existsSync(doc.uri.fsPath)) continue;
    const tmp = path.join(os.tmpdir(), `spitball-${crypto.randomUUID()}`);
    try {
      fs.writeFileSync(tmp, doc.getText());
      const d = await git(["diff", "--no-index", "--no-color", "--", doc.uri.fsPath, tmp], { okCodes: [0, 1] });
      if (d) parts.push(`=== unsaved edits: ${rel(doc.uri.fsPath)} ===\n${d.split("\n").slice(4).join("\n")}`);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
  return parts.filter((p) => p.trim()).join("\n");
}

// ---------------------------------------------------------------------------
// What the developer is doing right now
// ---------------------------------------------------------------------------

/** Innermost function/class/method around the cursor, e.g. "Store.remove". */
async function symbolAt(doc, pos) {
  try {
    const symbols = await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", doc.uri);
    const names = [];
    let level = symbols || [];
    for (;;) {
      const hit = level.find((s) => s.range && s.range.contains(pos));
      if (!hit) break;
      names.push(hit.name);
      level = hit.children || [];
    }
    return names.slice(-2).join(".") || undefined;
  } catch {
    return undefined;
  }
}

/** Light focus (for the live panel), or full focus with code and problems (for the agent). */
async function currentFocus(full = false) {
  const ed = vscode.window.activeTextEditor;
  if (!ed || !inRepo(ed.document)) return undefined;
  const doc = ed.document;
  const pos = ed.selection.active;
  const focus = { file: rel(doc.uri.fsPath), line: pos.line + 1, symbol: await symbolAt(doc, pos) };
  if (!full) return focus;

  const from = Math.max(0, pos.line - 40);
  const to = Math.min(doc.lineCount - 1, pos.line + 40);
  focus.snippet = Array.from({ length: to - from + 1 }, (_, i) => `${from + i + 1}${from + i === pos.line ? ">" : " "} ${doc.lineAt(from + i).text}`).join("\n");
  if (!ed.selection.isEmpty) focus.selection = doc.getText(ed.selection);
  focus.diagnostics = vscode.languages
    .getDiagnostics(doc.uri)
    .filter((d) => d.severity <= vscode.DiagnosticSeverity.Warning)
    .slice(0, 10)
    .map((d) => `${d.range.start.line + 1}: ${d.severity === vscode.DiagnosticSeverity.Error ? "error" : "warning"}: ${d.message}`);
  focus.recentFiles = recentFiles.filter((f) => f !== focus.file).slice(0, 5);
  return focus;
}

/** Sends a message to every open copy of the map (editor tab and/or sidebar view). */
const post = (msg) => [panel && panel.webview, sidebar && sidebar.webview].forEach((w) => w && w.postMessage(msg));
const pushAgent = () => post({ type: "spitball:agent", agent });

/** Cursor moved or editor changed: update the live panel (cheap, no AI) and restart the idle timer. */
function onFocusChanged(restartIdle) {
  clearTimeout(focusTimer);
  focusTimer = setTimeout(async () => {
    agent.focus = await currentFocus();
    if (agent.focus && recentFiles[0] !== agent.focus.file) {
      recentFiles = [agent.focus.file, ...recentFiles.filter((f) => f !== agent.focus.file)].slice(0, 8);
    }
    pushAgent();
  }, 300);
  if (restartIdle) scheduleIdeas();
}

// ---------------------------------------------------------------------------
// Map lifecycle
// ---------------------------------------------------------------------------

async function mapRepository() {
  repoRoot = repoRoot || (await findRepoRoot());
  if (!repoRoot) {
    vscode.window.showWarningMessage("Spitball: open a folder that is a git repository first.");
    return;
  }
  try {
    const { map } = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Spitball: mapping ${path.basename(repoRoot)} with Gemini…` },
      async () => api("/api/local/analyze", await snapshot()),
    );
    await ctx.workspaceState.update(MAP_KEY, map._id);
    lastHead = map.lastSyncedSha;
    if (sidebar) loadInto(sidebar.webview);
    if (panel || !sidebar) showPanel(true);
  } catch (e) {
    fail(e, true);
  }
}

async function open() {
  if (!mapId()) {
    const pick = await vscode.window.showInformationMessage(
      "Spitball hasn't mapped this repository yet. Analyze it now?",
      "Map This Repository",
    );
    if (pick) await mapRepository();
    return;
  }
  showPanel(false);
}

function showPanel(reload) {
  if (panel && !reload) {
    panel.reveal(undefined, true);
    return;
  }
  if (!panel) {
    // Docked beside the code (like a live side map), without stealing focus from the editor.
    panel = vscode.window.createWebviewPanel("spitball", "Spitball", { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, {
      enableScripts: true,
      // Keep the graph's layout and replay position when the tab is in the background.
      retainContextWhenHidden: true,
    });
    panel.iconPath = new vscode.ThemeIcon("type-hierarchy");
    panel.onDidDispose(() => (panel = undefined));
    panel.webview.onDidReceiveMessage(onPageMessage);
  }
  loadInto(panel.webview);
}

/** Points a webview at this repo's map, or at a "map this repo" prompt when there isn't one yet. */
async function loadInto(webview) {
  if (!mapId()) {
    webview.html = placeholder();
    return;
  }
  // asExternalUri maps localhost through port forwarding when VS Code runs remotely (SSH, Codespaces).
  const base = (await vscode.env.asExternalUri(vscode.Uri.parse(appUrl()))).toString(true).replace(/\/+$/, "");
  webview.html = html(`${base}/map/${mapId()}`, new URL(base).origin);
}

const sidebarProvider = {
  resolveWebviewView(view) {
    sidebar = view;
    view.webview.options = { enableScripts: true, enableCommandUris: true };
    view.webview.onDidReceiveMessage(onPageMessage);
    view.onDidDispose(() => (sidebar = undefined));
    loadInto(view.webview);
  },
};

/** Messages the map page sends up through the webview (see src/app/map/[id]/page.tsx and DetailPanel). */
async function onPageMessage(msg) {
  if (msg && msg.type === "spitball:ready") return pushAgent();
  // Webview frames can't always use the browser clipboard, so the page asks VS Code to copy instead.
  if (msg && msg.type === "spitball:copy" && typeof msg.text === "string") {
    await vscode.env.clipboard.writeText(msg.text);
    return post({ type: "spitball:copied" });
  }
  if (!msg || msg.type !== "spitball:openFile" || typeof msg.path !== "string" || !repoRoot) return;
  const abs = path.join(repoRoot, msg.path);
  if (rel(abs).startsWith("..")) return;
  if (!fs.existsSync(abs)) {
    vscode.window.showInformationMessage(`Spitball: ${msg.path} doesn't exist yet; this idea would create it.`);
    return;
  }
  await vscode.window.showTextDocument(vscode.Uri.file(abs), { viewColumn: vscode.ViewColumn.One, preview: false });
}

const refresh = (select) => post({ type: "spitball:refresh", select });

function placeholder() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; line-height: 1.5; }
    a { display: inline-block; margin-top: 8px; padding: 6px 12px; border-radius: 4px; text-decoration: none;
        background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  </style>
</head>
<body>
  <p>This repository doesn't have a mind map yet.</p>
  <a href="command:spitball.mapRepository">Map This Repository</a>
</body>
</html>`;
}

function html(src, origin) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const nonce = crypto.randomBytes(16).toString("base64");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${esc(origin)}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: var(--vscode-editor-background); }
    iframe { border: 0; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe id="app" src="${esc(src)}" allow="clipboard-read; clipboard-write"></iframe>
  <script nonce="${nonce}">
    // Relay between the extension and the embedded app (they can't talk directly).
    const vscode = acquireVsCodeApi();
    const frame = document.getElementById("app");
    const ORIGIN = ${JSON.stringify(origin)};
    window.addEventListener("message", (e) => {
      if (!e.data || typeof e.data.type !== "string" || !e.data.type.startsWith("spitball:")) return;
      if (e.source === frame.contentWindow) {
        if (e.origin === ORIGIN) vscode.postMessage(e.data);
      } else {
        frame.contentWindow.postMessage(e.data, ORIGIN);
      }
    });
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Growth: local commits and passive ideas
// ---------------------------------------------------------------------------

async function syncCommits() {
  const id = mapId();
  if (!id || !repoRoot) return;
  const now = await head();
  if (!now) return;

  const { map } = await api(`/api/maps/${id}`);
  const base = map.lastSyncedSha;
  if (base === now) return;

  // Commits since the map's last sync; after a rebase/amend the old sha isn't an ancestor, so send HEAD alone.
  const known = base && (await git(["merge-base", "--is-ancestor", base, now]).then(() => true, () => false));
  const logOut = await git(["log", "--format=%H%x1f%B%x1e", ...(known ? ["-n", "20", `${base}..${now}`] : ["-1", now])]);
  const commits = logOut
    .split("\x1e")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [sha, message] = s.split("\x1f");
      return { sha, message: (message || "").trim() };
    });
  if (!commits.length) return;
  const diff = known
    ? await git(["diff", "--no-color", "--no-ext-diff", base, now])
    : await git(["show", "--no-color", "--no-ext-diff", "--format=", now]);
  const tree = (await listFiles()).map((f) => f.path);

  setStatus("$(sync~spin) Spitball: reading your commit…", "Updating the map from your latest commit");
  const before = new Set(map.nodes.map((n) => n.id));
  const res = await api("/api/local/sync", { mapId: id, headSha: now, commits, patches: splitPatches(diff), tree });
  if (!res.changed) return setStatus("$(type-hierarchy) Spitball");

  const fresh = res.map.nodes.filter((n) => !before.has(n.id));
  const shipped = res.map.nodes.filter((n) => n.status === "shipped" && map.nodes.some((o) => o.id === n.id && o.status !== "shipped"));
  refresh(fresh[0] && fresh[0].id);
  const bits = [shipped.length && `${shipped.length} shipped`, fresh.length && `+${fresh.length} ideas`].filter(Boolean);
  setStatus(`$(git-commit) Spitball: ${bits.join(", ") || "synced"}`, "Map updated from your commit", 10000);
  if (fresh.length && cfg("notifications", true)) {
    notify(`🌱 Your commit grew the map: ${fresh.map((n) => `"${n.title}"`).join(", ")}`, fresh[0].id);
  }
}

function scheduleIdeas() {
  if (!cfg("passiveIdeas", true) || !mapId()) return;
  clearTimeout(ideaTimer);
  ideaTimer = setTimeout(() => queue(suggestIdeas), cfg("ideaDelaySeconds", 10) * 1000);
}

async function suggestIdeas(force = false) {
  const id = mapId();
  if (!id || !repoRoot) return;
  const wait = cfg("minIdeaIntervalSeconds", 45) * 1000 - (Date.now() - lastIdeaAt);
  if (!force && wait > 0) {
    clearTimeout(ideaTimer);
    ideaTimer = setTimeout(() => queue(suggestIdeas), wait);
    return;
  }
  const diff = await workInProgress();
  const focus = await currentFocus(true);
  // Same changes in the same function (moving the cursor around doesn't count) = nothing new to think about.
  const key = [diff, focus && focus.file, focus && focus.symbol, focus && focus.diagnostics.join("|")].join("\n");
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  if ((!diff.trim() && !focus) || (!force && hash === lastDiffHash)) return;
  lastDiffHash = hash;
  lastIdeaAt = Date.now();

  setStatus("$(lightbulb) Spitball: thinking about your code…", "The agent is looking at what you're doing");
  agent.state = "thinking";
  pushAgent();
  let res;
  try {
    const tree = (await listFiles()).map((f) => f.path);
    res = await api("/api/local/suggest", { mapId: id, diff, focus, tree });
  } finally {
    agent.state = "watching";
    pushAgent();
  }
  const { map, added, thought } = res;
  if (thought) agent.thought = thought;
  if (!added.length) {
    pushAgent();
    setStatus("$(type-hierarchy) Spitball", thought || "No new ideas right now");
    if (force) vscode.window.showInformationMessage(`Spitball: ${thought || "no new ideas right now."}`);
    return;
  }
  const ideas = map.nodes.filter((n) => added.includes(n.id));
  agent.pitches = [...added, ...agent.pitches].slice(0, 10);
  pushAgent();
  refresh(ideas[0].id);
  setStatus(`$(lightbulb) Spitball: +${ideas.length} idea${ideas.length > 1 ? "s" : ""}`, ideas.map((n) => n.title).join("\n"), 15000);
  if (cfg("notifications", true)) notify(`💡 ${ideas[0].title}: ${ideas[0].description}`, ideas[0].id);
}

async function notify(text, nodeId) {
  if ((await vscode.window.showInformationMessage(text, "Show in map")) !== "Show in map") return;
  showPanel(false);
  setTimeout(() => refresh(nodeId), panel || sidebar ? 0 : 1500);
}

// ---------------------------------------------------------------------------

async function activate(context) {
  ctx = context;
  log = vscode.window.createOutputChannel("Spitball");
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = "spitball.open";
  setStatus("$(type-hierarchy) Spitball");
  status.show();

  context.subscriptions.push(
    log,
    status,
    vscode.commands.registerCommand("spitball.open", open),
    vscode.commands.registerCommand("spitball.mapRepository", mapRepository),
    vscode.commands.registerCommand("spitball.showInSidebar", () => vscode.commands.executeCommand("spitball.map.focus")),
    vscode.window.registerWebviewViewProvider("spitball.map", sidebarProvider, {
      // Keep the graph's layout and replay position when the sidebar is collapsed.
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("spitball.suggestNow", () => queue(() => suggestIdeas(true))),
    vscode.commands.registerCommand("spitball.openInBrowser", () =>
      vscode.env.openExternal(vscode.Uri.parse(mapId() ? `${appUrl()}/map/${mapId()}` : appUrl())),
    ),
    // vscode://spitball.spitball/open (editor tab), /sidebar, or /map (map this repo), from a terminal or a web link.
    vscode.window.registerUriHandler({
      handleUri: (uri) => {
        if (uri.path === "/open") open();
        if (uri.path === "/sidebar") vscode.commands.executeCommand("spitball.map.focus");
        if (uri.path === "/map") vscode.commands.executeCommand("spitball.map.focus").then(mapRepository);
      },
    }),
    vscode.workspace.onDidChangeTextDocument((e) => e.contentChanges.length && inRepo(e.document) && scheduleIdeas()),
    vscode.window.onDidChangeActiveTextEditor(() => onFocusChanged(true)),
    vscode.window.onDidChangeTextEditorSelection((e) => inRepo(e.textEditor.document) && onFocusChanged(false)),
    vscode.workspace.onDidSaveTextDocument((doc) => inRepo(doc) && scheduleIdeas()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration("spitball.url")) return;
      if (panel) showPanel(true);
      if (sidebar) loadInto(sidebar.webview);
    }),
  );

  repoRoot = await findRepoRoot();
  if (!repoRoot) return;
  onFocusChanged(false);
  // Catch up on commits made while VS Code was closed, then watch HEAD for new ones.
  lastHead = await head();
  queue(syncCommits);
  const timer = setInterval(async () => {
    const now = await head();
    if (now && now !== lastHead) {
      lastHead = now;
      queue(syncCommits);
    }
  }, HEAD_POLL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function deactivate() {}

module.exports = { activate, deactivate };
