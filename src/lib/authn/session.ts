/**
 * Signed session cookies using Web Crypto, so the same code runs in the Edge middleware and in Node.
 * A cookie is "<payload>.<signature>"; the signature is HMAC-SHA256 over the payload with AUTH_SECRET.
 */
export const SESSION_COOKIE = "vs_session";
export const SESSION_DAYS = 30;
export const MIN_SECRET_LENGTH = 32;

export type Session = { uid: string; exp: number };

const enc = new TextEncoder();

const toB64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const key = (secret: string, usage: KeyUsage[]) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);

export async function signSession(session: Session, secret: string): Promise<string> {
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  const payload = toB64u(enc.encode(JSON.stringify(session)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret, ["sign"]), enc.encode(payload)));
  return `${payload}.${toB64u(sig)}`;
}

/** Returns the session only if the signature is valid and it has not expired; otherwise null. */
export async function verifySession(token: string | undefined, secret: string | undefined, now: number = Date.now()): Promise<Session | null> {
  if (!token || !secret || secret.length < MIN_SECRET_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    // crypto.subtle.verify compares in constant time
    const ok = await crypto.subtle.verify("HMAC", await key(secret, ["verify"]), fromB64u(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64u(parts[0]))) as Partial<Session>;
    if (typeof s.uid !== "string" || !s.uid || typeof s.exp !== "number" || s.exp <= now) return null;
    return { uid: s.uid, exp: s.exp };
  } catch {
    return null;
  }
}

export const newSession = (uid: string, now: number = Date.now()): Session => ({ uid, exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000 });
