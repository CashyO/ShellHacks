import { MongoClient, type Db } from "mongodb";
import type { CodeMap } from "./types";

// MongoDB Atlas when MONGODB_URI is set; otherwise an in-memory fallback so the app still runs without keys.
const g = globalThis as unknown as {
  __mongoDb?: Promise<Db>;
  __memMaps?: Map<string, CodeMap>;
  __memCache?: Map<string, unknown>;
};
const memMaps = (g.__memMaps ??= new Map<string, CodeMap>());
const memCache = (g.__memCache ??= new Map<string, unknown>());

export const hasMongo = () => !!process.env.MONGODB_URI;

function getDb(): Promise<Db> {
  if (!g.__mongoDb) {
    const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 8000 });
    g.__mongoDb = client
      .connect()
      .then((c) => c.db(process.env.MONGODB_DB || "projectgraph"))
      .catch((e) => {
        g.__mongoDb = undefined;
        throw new Error(`MongoDB connection failed: ${(e as Error).message}`);
      });
  }
  return g.__mongoDb;
}

export async function getMap(id: string): Promise<CodeMap | null> {
  if (!hasMongo()) return memMaps.get(id) ?? null;
  return (await getDb()).collection<CodeMap>("maps").findOne({ _id: id });
}

export async function saveMap(map: CodeMap): Promise<CodeMap> {
  map.updatedAt = new Date().toISOString();
  if (!hasMongo()) {
    memMaps.set(map._id, map);
    return map;
  }
  await (await getDb()).collection<CodeMap>("maps").replaceOne({ _id: map._id }, map, { upsert: true });
  return map;
}

interface CacheDoc {
  _id: string;
  response: unknown;
  createdAt: string;
}

export async function getCached<T>(key: string): Promise<T | undefined> {
  if (!hasMongo()) return memCache.get(key) as T | undefined;
  const doc = await (await getDb()).collection<CacheDoc>("ai_cache").findOne({ _id: key });
  return doc?.response as T | undefined;
}

export async function setCached(key: string, response: unknown): Promise<void> {
  if (!hasMongo()) {
    memCache.set(key, response);
    return;
  }
  await (await getDb())
    .collection<CacheDoc>("ai_cache")
    .replaceOne({ _id: key }, { response, createdAt: new Date().toISOString() }, { upsert: true });
}
