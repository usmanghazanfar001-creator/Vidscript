import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { findOwnedRender } from "@/lib/render/jobs";
import { slugify } from "@/lib/render/range";
import { streamFile } from "@/lib/http/streamFile";
import { RENDER_FILES, renderFilePath } from "@/lib/storage/local";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { renderId: string } }) {
  try {
    const url = new URL(req.url);
    const name = z.enum(RENDER_FILES).safeParse(url.searchParams.get("name"));
    if (!name.success) return NextResponse.json({ error: "Unknown file" }, { status: 400 });

    const job = await findOwnedRender(params.renderId, requireUserId());
    if (!job) return NextResponse.json({ error: "Render not found" }, { status: 404 });
    if (job.status !== "COMPLETED") return NextResponse.json({ error: "This render is not finished" }, { status: 409 });

    const base = slugify(job.project.title);
    return streamFile(req, renderFilePath(job.id, name.data), {
      contentType: name.data.endsWith(".mp4") ? "video/mp4" : name.data.endsWith(".txt") ? "text/plain; charset=utf-8" : "application/json",
      downloadName: url.searchParams.get("download") ? (name.data === "draft.mp4" ? `${base}-silent-draft.mp4` : `${base}-${name.data}`) : undefined,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error(err);
    return NextResponse.json({ error: "Could not read the file" }, { status: 500 });
  }
}
