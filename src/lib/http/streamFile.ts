import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/render/range";

/** Streams a file with HTTP Range support so <video>/<audio> can seek. Callers must authorize first. */
export async function streamFile(req: Request, file: string, opts: { contentType: string; downloadName?: string }): Promise<Response> {
  const size = (await stat(file).catch(() => null))?.size;
  if (size == null) return Response.json({ error: "File is missing from storage" }, { status: 404 });

  const headers: Record<string, string> = { "Content-Type": opts.contentType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=0" };
  if (opts.downloadName) headers["Content-Disposition"] = `attachment; filename="${opts.downloadName.replace(/"/g, "")}"`;

  const range = parseRange(req.headers.get("range"), size);
  if (range === "unsatisfiable") return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  const { start, end } = range ?? { start: 0, end: Math.max(0, size - 1) };
  const body = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: { ...headers, "Content-Length": String(size === 0 ? 0 : end - start + 1), ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}) },
  });
}
