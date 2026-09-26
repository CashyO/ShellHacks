import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey }));
}

// In-memory cache; swap for the Mongo `ai_cache` collection once db.ts exists.
const g = globalThis as unknown as { __aiCache?: Map<string, unknown> };
const cache = (g.__aiCache ??= new Map<string, unknown>());

async function callModel(model: string, prompt: string, responseSchema: object): Promise<string> {
  const res = await getClient().models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseJsonSchema: responseSchema },
  });
  if (!res.text) throw new Error("Gemini returned an empty response");
  return res.text;
}

export async function generateJSON<T>(
  prompt: string,
  responseSchema: object,
  zodSchema: ZodType<T>,
): Promise<T> {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error("GEMINI_MODEL is not set");

  const useCache = process.env.AI_CACHE !== "off";
  const key = createHash("sha256").update(model + "\n" + prompt).digest("hex");
  if (useCache && cache.has(key)) return cache.get(key) as T;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = attempt === 0 ? prompt : `${prompt}\n\nYour previous reply was invalid: ${lastError}\nReturn corrected JSON only.`;
    try {
      const parsed = zodSchema.parse(JSON.parse(await callModel(model, p, responseSchema)));
      if (useCache) cache.set(key, parsed);
      return parsed;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Gemini response failed validation after retry: ${lastError}`);
}
