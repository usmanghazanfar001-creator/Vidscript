import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { streamFile } from "@/lib/http/streamFile";
import { assetPath } from "@/lib/assets/store";

export const runtime = "nodejs";

/** Serves a stored asset to its owner, with Range support so video can seek. */
export async function GET(req: Request, { params }: { params: { assetId: string } }) {
  try {
    const userId = requireUserId();
    const a = await prisma.mediaAsset.findFirst({ where: { id: params.assetId, userId } });
    if (!a) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    return streamFile(req, assetPath(userId, a.storageKey), { contentType: a.mimeType });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Could not read the asset" }, { status: 500 });
  }
}
