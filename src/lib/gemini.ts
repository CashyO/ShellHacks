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

const TRANSIENT = new Set([429, 500, 503]);

// Retries temporary API failures (rate limit / overload) with backoff; other errors surface immediately.
async function callModel(model: string, prompt: string, responseSchema: object): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await getClient().models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: responseSchema },
      });
      if (!res.text) throw new Error("Gemini returned an empty response");
      return res.text;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (attempt >= 3 || status === undefined || !TRANSIENT.has(status)) throw e;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    }
  }
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
    const text = await callModel(model, p, responseSchema);
    try {
      const parsed = zodSchema.parse(JSON.parse(text));
      if (useCache) cache.set(key, parsed);
      return parsed;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Gemini response failed validation after retry: ${lastError}`);
}
