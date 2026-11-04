import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { ensureUser } from "@/lib/db/storyboards";
import { DownloadError } from "@/lib/assets/download";
import { ensureAsset } from "@/lib/assets/store";
import { candidateSchema, sceneFieldsFromAsset } from "@/lib/assets/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ candidate: candidateSchema, query: z.string().max(100).nullish() });

/** Downloads (or reuses the cached copy of) one chosen search result and returns the scene fields that describe it. */
export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const { candidate, query } = bodySchema.parse(await req.json().catch(() => null));
    await ensureUser(userId);
    const asset = await ensureAsset(userId, candidate, query ?? null);
    return NextResponse.json({ asset, fields: sceneFieldsFromAsset(asset) });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
    if (e instanceof DownloadError) return NextResponse.json({ error: e.message, retryable: true }, { status: 502 });
    console.error("asset fetch failed", e);
    return NextResponse.json({ error: "Could not download the asset. Please retry." }, { status: 500 });
  }
}
