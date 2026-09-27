import { z } from "zod";
import { NextResponse } from "next/server";
import { getMap, saveMap } from "@/lib/db";
import { isMock, mockCreateNode } from "@/lib/mock";
import { getSession } from "@/lib/session";
import type { IdeaNode, NodeType } from "@/lib/types";

const REAL = true;

const Body = z.object({
  mapId: z.string(),
  title: z.string().min(1).max(80),
  description: z.string().max(400).optional(),
  rationale: z.string().max(400).optional(),
  type: z.enum(["feature", "improvement", "fix", "security", "test"]),
  effort: z.enum(["S", "M", "L"]),
  files: z.array(z.string()).max(10).optional(),
  parentId: z.string().nullable().optional(),
});

// Manual idea creation (steer the map yourself, not just accept what Gemini suggested).
// Not in the original ARCHITECTURE §6 contract; documented there under §6a.
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: e instanceof z.ZodError ? e.issues[0]?.message : "Invalid request" }, { status: 400 });
  }

  if (isMock() || !REAL) {
    try {
      return NextResponse.json({ map: mockCreateNode(body.mapId, body) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 404 });
    }
  }

  try {
    const map = await getMap(body.mapId);
    if (!map) return NextResponse.json({ error: "Map not found" }, { status: 404 });
    if (body.parentId && !map.nodes.some((n) => n.id === body.parentId)) {
      return NextResponse.json({ error: "parentId does not exist on this map" }, { status: 400 });
    }

    const login = getSession(req)?.login;
    const now = new Date().toISOString();
    const node: IdeaNode = {
      title: body.title.trim(),
      description: body.description?.trim() || "Added by hand.",
      rationale: body.rationale?.trim() || "Added by a teammate, not suggested by Gemini.",
      type: body.type as NodeType,
      effort: body.effort,
      files: (body.files ?? []).map((f) => f.trim()).filter(Boolean),
      id: crypto.randomUUID().slice(0, 8),
      parentId: body.parentId ?? null,
      status: "suggested",
      origin: "manual",
      createdAt: now,
      createdBy: login,
    };
    map.nodes.push(node);
    map.events.push({ at: now, kind: "create", text: `${login ? `${login} added` : "Added"} "${node.title}" by hand`, nodeId: node.id });
    return NextResponse.json({ map: await saveMap(map) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

