import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { createLimiter } from "@/lib/authn/limiter";
import { verifyPassword } from "@/lib/authn/password";
import { MIN_SECRET_LENGTH, SESSION_COOKIE, SESSION_DAYS, newSession, signSession } from "@/lib/authn/session";

export const runtime = "nodejs";

const limiter = ((globalThis as unknown as { __vsLoginLimiter?: ReturnType<typeof createLimiter> }).__vsLoginLimiter ??= createLimiter({ max: 5, windowMs: 15 * 60 * 1000 }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const hash = process.env.OWNER_PASSWORD_HASH;
  const secret = process.env.AUTH_SECRET;
  if (!hash || !secret || secret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "Sign-in is not set up on this server. Add OWNER_PASSWORD_HASH and AUTH_SECRET (see README)." }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const gate = limiter.check(ip);
  if (!gate.allowed) {
    return NextResponse.json({ error: `Too many wrong passwords. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minutes.` }, { status: 429 });
  }

  const body = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter your password." }, { status: 400 });

  if (!(await verifyPassword(body.data.password, hash))) {
    limiter.fail(ip);
    await sleep(500); // slows guessing a little more
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  limiter.reset(ip);

  // The owner is a single fixed user. Set OWNER_USER_ID=dev-user to keep projects created in local development.
  const uid = process.env.OWNER_USER_ID || "owner";
  await prisma.user.upsert({ where: { id: uid }, create: { id: uid, email: process.env.OWNER_EMAIL || `${uid}@local.dev` }, update: {} });

  cookies().set(SESSION_COOKIE, await signSession(newSession(uid), secret), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return NextResponse.json({ ok: true });
}
