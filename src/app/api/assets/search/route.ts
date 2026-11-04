import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { searchAssets } from "@/lib/assets/search";
import { searchRequestSchema } from "@/lib/assets/types";

export const runtime = "nodejs";

/** Searches the free stock providers for a query. Nothing is downloaded; results are for the asset picker. */
export async function POST(req: Request) {
  try {
    requireUserId();
    const body = searchRequestSchema.parse(await req.json().catch(() => null));
    const result = await searchAssets(body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
    console.error("asset search failed", e);
    return NextResponse.json({ error: "Search failed. Please retry." }, { status: 500 });
  }
}
