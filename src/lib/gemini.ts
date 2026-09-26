import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { getCached, setCached } from "./db";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return (client ??= new GoogleGenAI({ apiKey }));
}

const TRANSIENT = new Set([429, 500, 503]);
const statusOf = (e: unknown) => (e as { status?: number }).status;
const isTransient = (e: unknown) => {
  const s = statusOf(e);
  return s !== undefined && TRANSIENT.has(s);
};

// Retries temporary API failures (rate limit / overload) with a short backoff.
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
      if (attempt >= 2 || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

// Primary model first; if it stays overloaded, try GEMINI_FALLBACK_MODEL once.
async function callWithFallback(prompt: string, responseSchema: object): Promise<string> {
  const primary = process.env.GEMINI_MODEL!;
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  try {
    return await callModel(primary, prompt, responseSchema);
  } catch (e) {
    if (!isTransient(e)) throw e;
    if (fallback && fallback !== primary) {
      try {
        return await callModel(fallback, prompt, responseSchema);
      } catch (e2) {
        e = e2;
        if (!isTransient(e)) throw e;
      }
    }
    const err = new Error("Gemini is overloaded right now. Please try again in a moment.") as Error & { status: number };
    err.status = 503;
    throw err;
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
  if (useCache) {
    const hit = await getCached<T>(key);
    if (hit !== undefined) return hit;
  }

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = attempt === 0 ? prompt : `${prompt}\n\nYour previous reply was invalid: ${lastError}\nReturn corrected JSON only.`;
    const text = await callWithFallback(p, responseSchema);
    try {
      const parsed = zodSchema.parse(JSON.parse(text));
      if (useCache) await setCached(key, parsed);
      return parsed;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`Gemini response failed validation after retry: ${lastError}`);
}
