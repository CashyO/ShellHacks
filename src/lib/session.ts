import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// "Sign in with GitHub" session: the user's GitHub token lives ONLY in this encrypted, httpOnly cookie.
// The browser can't read it, and the server needs SESSION_SECRET to open it.

export const SESSION_COOKIE = "pg_session";
export const STATE_COOKIE = "pg_oauth_state";
const WEEK = 60 * 60 * 24 * 7;

export interface Session {
  token: string;
  login: string;
  avatarUrl: string;
}

const key = (): Buffer | null => {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 16 ? createHash("sha256").update(secret).digest() : null;
};

/** True when GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and SESSION_SECRET are all set. */
export const authConfigured = () => !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && key());

export function seal(session: Session): string {
  const k = key();
  if (!k) throw new Error("SESSION_SECRET is not set (needs 16+ characters)");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal(value: string): Session | null {
  try {
    const k = key();
    if (!k) return null;
    const buf = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", k, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    const s = JSON.parse(dec.toString("utf8")) as Session;
    return s.token && s.login ? s : null;
  } catch {
    return null;
  }
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function getSession(req: Request): Session | null {
  const v = readCookie(req, SESSION_COOKIE);
  return v ? unseal(v) : null;
}

export function cookieHeader(name: string, value: string, maxAge = WEEK, secure = false): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export const clearCookieHeader = (name: string, secure = false) => cookieHeader(name, "", 0, secure);

/** Public origin of this app (APP_URL wins; otherwise from the request, honoring proxy headers such as Vercel's). */
export function appOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const newState = () => randomBytes(16).toString("hex");
