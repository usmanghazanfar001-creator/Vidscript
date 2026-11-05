/** Pure rules for who may see what. No Node or Next imports, so the Edge middleware can use them. */

export const USER_HEADER = "x-vs-user";

/** Pages and endpoints reachable without signing in. Everything else needs a valid session. */
const PUBLIC_PATHS = ["/", "/login", "/api/auth/login", "/api/auth/logout"];

export const isPublicPath = (pathname: string) => PUBLIC_PATHS.includes(pathname);

export function decideAccess(pathname: string, signedIn: boolean): "allow" | "login" | "deny" {
  if (isPublicPath(pathname) || signedIn) return "allow";
  return pathname.startsWith("/api/") ? "deny" : "login";
}

/** Only same-site paths are accepted after login, so a crafted link cannot send you to another website. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return "/dashboard";
  return next;
}

/**
 * Headers the app receives. The user header is ALWAYS removed first, so a visitor can never claim to be someone else,
 * and is only set again from a verified session.
 */
export function buildForwardHeaders(incoming: Headers, verifiedUid: string | null): Headers {
  const out = new Headers(incoming);
  out.delete(USER_HEADER);
  if (verifiedUid) out.set(USER_HEADER, verifiedUid);
  return out;
}

/** In production only a verified session counts. DEV_USER_ID is a local-development shortcut and is ignored there. */
export function resolveUserId(opts: { headerUid: string | null; nodeEnv: string | undefined; devUserId: string | undefined }): string | null {
  if (opts.headerUid) return opts.headerUid;
  if (opts.nodeEnv !== "production" && opts.devUserId) return opts.devUserId;
  return null;
}
