import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { streamFile } from "@/lib/http/streamFile";
import { storageRoot } from "@/lib/storage/local";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const v = await prisma.voiceover.findFirst({ where: { projectId: params.projectId, project: { userId: requireUserId() } } });
    if (!v?.storageKey) return NextResponse.json({ error: "No voiceover" }, { status: 404 });
    return streamFile(req, path.join(storageRoot(), v.storageKey), {
      contentType: v.mimeType ?? "audio/mpeg",
      downloadName: new URL(req.url).searchParams.get("download") ? v.fileName : undefined,
    });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
    return NextResponse.json({ error: "Could not read the file" }, { status: 500 });
  }
}
