import { NextResponse, type NextRequest } from "next/server";
import { buildForwardHeaders, decideAccess } from "@/lib/authn/access";
import { SESSION_COOKIE, verifySession } from "@/lib/authn/session";

/**
 * Every page and API route except the public ones needs a valid signed session.
 * The verified user id is passed to the app in a header that clients can never set themselves.
 */
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET);
  // Local development shortcut (never in production): DEV_USER_ID acts as the signed-in user.
  const devShortcut = process.env.NODE_ENV !== "production" && Boolean(process.env.DEV_USER_ID);
  const decision = decideAccess(req.nextUrl.pathname, session !== null || devShortcut);

  if (decision === "deny") return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (decision === "login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers: buildForwardHeaders(req.headers, session?.uid ?? null) } });
}

export const config = {
  // Run on everything except Next's static files and the app icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|icon-192.png|apple-icon.png|logo.png).*)"],
};
