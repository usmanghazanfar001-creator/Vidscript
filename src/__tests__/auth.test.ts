import { describe, expect, it } from "vitest";
import { cleanStoredHash, hashPassword, isValidStoredHash, verifyPassword } from "@/lib/authn/password";
import { newSession, signSession, verifySession, SESSION_DAYS } from "@/lib/authn/session";
import { buildForwardHeaders, decideAccess, resolveUserId, safeNext } from "@/lib/authn/access";
import { createLimiter } from "@/lib/authn/limiter";

const SECRET = "a".repeat(64);

describe("password hashing", () => {
  it("accepts the right password and rejects wrong ones", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });
  it("uses a fresh salt each time and a format .env files do not mangle", async () => {
    const [a, b] = [await hashPassword("same password here"), await hashPassword("same password here")];
    expect(a === b).toBe(false);
    expect(a.includes("$")).toBe(false);
    expect(a.startsWith("scrypt:")).toBe(true);
  });
  it("rejects missing, malformed and tampered settings instead of crashing", async () => {
    const h = await hashPassword("a long enough password");
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "plaintext-password")).toBe(false);
    expect(await verifyPassword("x", h.replace("scrypt:16384", "scrypt:99999999999"))).toBe(false);
    expect(await verifyPassword("x", h.replace("scrypt:16384", "scrypt:16385"))).toBe(false); // not a power of two
    expect(await verifyPassword("x", h.replace(/:[0-9a-f]+$/, ":zz"))).toBe(false);
  });
});

describe("session cookies", () => {
  it("round-trips a signed session", async () => {
    const token = await signSession(newSession("owner", 1000), SECRET);
    expect(await verifySession(token, SECRET, 2000)).toEqual({ uid: "owner", exp: 1000 + SESSION_DAYS * 86400000 });
  });
  it("rejects a tampered payload (someone trying to become another user)", async () => {
    const token = await signSession(newSession("owner", 1000), SECRET);
    const [, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ uid: "someone-else", exp: 9e15 })).replace(/=+$/, "");
    expect(await verifySession(`${forged}.${sig}`, SECRET, 2000)).toBeNull();
  });
  it("rejects a tampered signature, the wrong secret, expired and malformed tokens", async () => {
    const token = await signSession(newSession("owner", 1000), SECRET);
    expect(await verifySession(token.slice(0, -2) + "xx", SECRET, 2000)).toBeNull();
    expect(await verifySession(token, "b".repeat(64), 2000)).toBeNull();
    expect(await verifySession(token, SECRET, 1000 + SESSION_DAYS * 86400000 + 1)).toBeNull();
    for (const bad of [undefined, "", "abc", "a.b.c", ".", "a."]) expect(await verifySession(bad, SECRET, 2000), String(bad)).toBeNull();
  });
  it("refuses to work with a weak or missing secret", async () => {
    await expect(signSession(newSession("owner"), "short")).rejects.toThrow(/AUTH_SECRET/);
    const token = await signSession(newSession("owner", 1000), SECRET);
    expect(await verifySession(token, undefined, 2000)).toBeNull();
    expect(await verifySession(token, "short", 2000)).toBeNull();
  });
});

describe("access rules", () => {
  it("lets signed-out visitors see only the landing and login pages", () => {
    expect(decideAccess("/", false)).toBe("allow");
    expect(decideAccess("/login", false)).toBe("allow");
    expect(decideAccess("/api/auth/login", false)).toBe("allow");
    expect(decideAccess("/dashboard", false)).toBe("login");
    expect(decideAccess("/projects/abc", false)).toBe("login");
    expect(decideAccess("/renders/abc", false)).toBe("login");
  });
  it("answers signed-out API calls with a denial, never data", () => {
    for (const p of ["/api/projects", "/api/assets/search", "/api/groq/models", "/api/renders/x/file", "/api/projects/x/voiceover"]) expect(decideAccess(p, false), p).toBe("deny");
  });
  it("lets signed-in users through", () => expect(decideAccess("/api/projects", true)).toBe("allow"));
  it("does not treat look-alike paths as public", () => {
    for (const p of ["/login/", "/api/auth/login/x", "/api/auth", "/loginx", "//login"]) expect(decideAccess(p, false), p).not.toBe("allow");
  });
  it("only redirects to same-site paths after login", () => {
    expect(safeNext("/projects/abc?x=1")).toBe("/projects/abc?x=1");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil", "", null, undefined, "/a\nb"]) expect(safeNext(bad as string | null), String(bad)).toBe("/dashboard");
  });
});

describe("user identity", () => {
  it("never trusts a user header sent by the client", () => {
    const incoming = new Headers({ "x-vs-user": "attacker", accept: "x" });
    expect(buildForwardHeaders(incoming, null).get("x-vs-user")).toBeNull();
    expect(buildForwardHeaders(incoming, "owner").get("x-vs-user")).toBe("owner");
    expect(buildForwardHeaders(incoming, null).get("accept")).toBe("x");
  });
  it("ignores DEV_USER_ID in production", () => {
    expect(resolveUserId({ headerUid: null, nodeEnv: "production", devUserId: "dev-user" })).toBeNull();
    expect(resolveUserId({ headerUid: null, nodeEnv: "development", devUserId: "dev-user" })).toBe("dev-user");
    expect(resolveUserId({ headerUid: "owner", nodeEnv: "production", devUserId: "dev-user" })).toBe("owner");
    expect(resolveUserId({ headerUid: null, nodeEnv: "development", devUserId: undefined })).toBeNull();
  });
});

describe("sign-in rate limit", () => {
  it("blocks after 5 failures, tells how long, and recovers", () => {
    const l = createLimiter({ max: 5, windowMs: 900000 });
    for (let i = 0; i < 5; i++) { expect(l.check("ip", i).allowed).toBe(true); l.fail("ip", i); }
    const blocked = l.check("ip", 10);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(800);
    expect(l.check("other", 10).allowed).toBe(true);
    expect(l.check("ip", 900001).allowed).toBe(true);
  });
  it("a successful sign-in clears the count", () => {
    const l = createLimiter({ max: 2, windowMs: 1000 });
    l.fail("ip", 0); l.fail("ip", 1);
    expect(l.check("ip", 2).allowed).toBe(false);
    l.reset("ip");
    expect(l.check("ip", 3).allowed).toBe(true);
  });
});

describe("pasting the hash into a settings page", () => {
  it("still works with the label, quotes, spaces or a trailing newline pasted along with it", async () => {
    const h = await hashPassword("my long password 123");
    for (const pasted of [`OWNER_PASSWORD_HASH=${h}`, `OWNER_PASSWORD_HASH = ${h}`, `"${h}"`, `'${h}'`, `  ${h}\n`, `\n${h}\r\n`, `OWNER_PASSWORD_HASH="${h}"`]) {
      expect(cleanStoredHash(pasted), pasted.slice(0, 30)).toBe(h);
      expect(await verifyPassword("my long password 123", pasted)).toBe(true);
      expect(await verifyPassword("not the password", pasted)).toBe(false);
    }
  });
  it("tells a broken setting apart from a wrong password", async () => {
    const h = await hashPassword("my long password 123");
    expect(isValidStoredHash(h)).toBe(true);
    expect(isValidStoredHash(`OWNER_PASSWORD_HASH=${h}`)).toBe(true);
    for (const broken of [undefined, "", "my plain password", h.slice(0, 40), h.replace("scrypt", "bcrypt"), `${h}:extra`]) expect(isValidStoredHash(broken), String(broken)).toBe(false);
  });
});

