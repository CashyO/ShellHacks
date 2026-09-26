import type { Snapshot } from "./prompts";

// Stand-in for the real demo repo (chronos-scheduler) until github.ts and Julian's repo exist.
const files: Snapshot["files"] = [
  {
    path: "README.md",
    content: "# chronos-scheduler\n\nA small day-view scheduling app. React frontend, Express events API, JSON file store.\n\n## Run\n`npm install && npm run dev`\n",
  },
  {
    path: "package.json",
    content: '{\n  "name": "chronos-scheduler",\n  "scripts": { "dev": "node server/index.js" },\n  "dependencies": { "express": "^4.19.0", "react": "^18.3.0", "react-dom": "^18.3.0" }\n}\n',
  },
  {
    path: "server/index.js",
    content: `const express = require("express");
const db = require("./db");
const app = express();
app.use(express.json());

app.get("/events", async (req, res) => {
  res.json(await db.all("events"));
});

app.post("/events", async (req, res) => {
  const event = await db.insert("events", req.body);
  res.status(201).json(event);
});

app.listen(3000, () => console.log("chronos on :3000"));
`,
  },
  {
    path: "server/db.js",
    content: `const fs = require("fs/promises");
const FILE = "./data.json";

async function read() {
  try { return JSON.parse(await fs.readFile(FILE, "utf8")); } catch { return {}; }
}
async function all(table) { return (await read())[table] || []; }
async function insert(table, row) {
  const data = await read();
  data[table] = [...(data[table] || []), { id: Date.now(), ...row }];
  await fs.writeFile(FILE, JSON.stringify(data));
  return data[table].at(-1);
}
module.exports = { all, insert };
`,
  },
  {
    path: "src/schedule.js",
    content: `export function blockDuration(block) {
  return (block.end - block.start) / 60000;
}

export function parseEvent(raw) {
  return {
    ...raw,
    start: new Date(raw.start),
    end: new Date(raw.end),
  };
}

export function addEvent(list, event) {
  return [...list, event];
}
`,
  },
  {
    path: "src/store.js",
    content: `import { addEvent, parseEvent } from "./schedule";

let events = [];
const listeners = new Set();

export async function load() {
  const res = await fetch("/events");
  events = (await res.json()).map(parseEvent);
  listeners.forEach((l) => l(events));
}

export async function create(event) {
  const res = await fetch("/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event) });
  events = addEvent(events, parseEvent(await res.json()));
  listeners.forEach((l) => l(events));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
`,
  },
  {
    path: "src/api/events.js",
    content: `export const EVENT_FIELDS = ["title", "start", "end"];

export function toPayload(form) {
  return { title: form.title, start: form.start, end: form.end };
}
`,
  },
  {
    path: "src/calendar.jsx",
    content: `import { useEffect, useState } from "react";
import { blockDuration } from "./schedule";
import { load, subscribe, create } from "./store";

export function goToDay(date) {
  window.location.hash = date.toISOString().slice(0, 10);
}

export function openNewEvent() {
  const title = window.prompt("Title?");
  if (title) create({ title, start: new Date().toISOString(), end: new Date(Date.now() + 3600000).toISOString() });
}

export default function Calendar() {
  const [events, setEvents] = useState([]);
  useEffect(() => { load(); return subscribe(setEvents); }, []);
  return (
    <div className="day">
      <button onClick={openNewEvent}>New event</button>
      {events.map((e) => (
        <div key={e.id} className="block" style={{ position: "absolute", top: e.start.getHours() * 40, height: blockDuration(e) }}>
          {e.title}
        </div>
      ))}
    </div>
  );
}
`,
  },
  {
    path: "src/main.jsx",
    content: `import { createRoot } from "react-dom/client";
import Calendar from "./calendar";

createRoot(document.getElementById("root")).render(<Calendar />);
`,
  },
];

export const DEMO_OWNER = "projectgraph-demo";
export const DEMO_REPO = "chronos-scheduler";

export const DEMO_SNAPSHOT: Snapshot = {
  defaultBranch: "main",
  headSha: "a1b2c3d",
  tree: files.map((f) => f.path),
  files,
};
