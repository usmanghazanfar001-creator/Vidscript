import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { streamFile } from "@/lib/http/streamFile";
import { storageRoot } from "@/lib/storage/local";

export const runtime = "nodejs";

/** Returns the original Lafzaly file exactly as uploaded. */
export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const row = await prisma.captionFile.findFirst({ where: { projectId: params.projectId, project: { userId: requireUserId() } } });
    if (!row?.storageKey) return NextResponse.json({ error: "No caption file" }, { status: 404 });
    return streamFile(req, path.join(storageRoot(), row.storageKey), {
      contentType: "text/plain; charset=utf-8",
      downloadName: new URL(req.url).searchParams.get("download") ? row.fileName : undefined,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Could not read the file" }, { status: 500 });
  }
}
