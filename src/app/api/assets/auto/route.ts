import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { ensureUser } from "@/lib/db/storyboards";
import { DownloadError } from "@/lib/assets/download";
import { pickBest, searchAssets } from "@/lib/assets/search";
import { ensureAsset } from "@/lib/assets/store";
import { searchRequestSchema, sceneFieldsFromAsset, PROVIDER_LABELS } from "@/lib/assets/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Finds and downloads the best stock match for one scene. Never pretends: when nothing is found it says why,
 * so the editor can show a placeholder and let the user pick something else.
 */
export async function POST(req: Request) {
  try {
    const userId = requireUserId();
    const body = searchRequestSchema.parse(await req.json().catch(() => null));
    await ensureUser(userId);

    const search = await searchAssets(body);
    if (search.configured.length === 0) {
      return NextResponse.json({ found: false, reason: "no_provider", message: "Video search needs a Pexels or Pixabay API key. Add PEXELS_API_KEY or PIXABAY_API_KEY to .env and restart the dev server." });
    }
    const ranked = pickBest(search.candidates, body.orientation);
    const problems = search.providers.filter((p) => !p.ok).map((p) => p.error!);
    if (ranked.length === 0) {
      return NextResponse.json({ found: false, reason: "no_match", message: `No suitable ${body.kind} found for "${body.query}".${problems.length ? ` ${problems.join("; ")}.` : ""}`, providers: search.providers });
    }

    let lastError = "";
    for (const candidate of ranked.slice(0, 3)) {
      try {
        const asset = await ensureAsset(userId, candidate, body.query);
        return NextResponse.json({ found: true, asset, fields: sceneFieldsFromAsset(asset), source: PROVIDER_LABELS[candidate.provider] });
      } catch (e) {
        if (!(e instanceof DownloadError)) throw e;
        lastError = e.message;
      }
    }
    return NextResponse.json({ found: false, reason: "download_failed", message: `Found matches but could not download them. ${lastError}` });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
    console.error("asset auto failed", e);
    return NextResponse.json({ error: "Asset search failed. Please retry." }, { status: 500 });
  }
}
