import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isAllowedAssetUrl } from "./hosts";

export class DownloadError extends Error {}

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export type SniffedType = { mime: "image/jpeg" | "image/png" | "image/webp" | "video/mp4"; ext: "jpg" | "png" | "webp" | "mp4"; kind: "image" | "video" };

/** Identifies a file by its first bytes, never by what the server claims, so an HTML error page can't be saved as an image. */
export function sniffType(head: Buffer): SniffedType | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png", kind: "image" };
  if (head.length >= 12 && head.toString("ascii", 0, 4) === "RIFF" && head.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (head.length >= 12 && head.toString("ascii", 4, 8) === "ftyp") return { mime: "video/mp4", ext: "mp4", kind: "video" };
  return null;
}

export type Downloaded = { tmpPath: string; sha256: string; bytes: number; type: SniffedType };

/**
 * Downloads one file safely: every URL (including each redirect) must pass `isAllowed`, the size is capped while
 * streaming, the type is checked from the bytes, and a SHA-256 is computed on the way through.
 */
export async function downloadToFile(
  url: string,
  opts: { dir: string; kind: "image" | "video"; maxBytes?: number; isAllowed?: (u: string) => boolean; userAgent?: string; timeoutMs?: number },
): Promise<Downloaded> {
  const isAllowed = opts.isAllowed ?? isAllowedAssetUrl;
  const maxBytes = opts.maxBytes ?? (opts.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES);
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 120_000);

  let current = url;
  let res: Response | null = null;
  for (let hop = 0; hop <= 3; hop++) {
    if (!isAllowed(current)) throw new DownloadError("The download address is not from an allowed stock provider.");
    res = await fetch(current, { redirect: "manual", signal, headers: { "User-Agent": opts.userAgent ?? "Vidscript/0.1" } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new DownloadError("The provider sent a broken redirect.");
      current = new URL(loc, current).toString();
      res = null;
      continue;
    }
    break;
  }
  if (!res) throw new DownloadError("Too many redirects.");
  if (!res.ok || !res.body) throw new DownloadError(`The provider answered HTTP ${res.status}.`);
  if (Number(res.headers.get("content-length")) > maxBytes) throw new DownloadError("The file is larger than the allowed size.");

  await mkdir(opts.dir, { recursive: true });
  const tmpPath = path.join(opts.dir, `.tmp-${randomBytes(6).toString("hex")}`);
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > maxBytes) return cb(new DownloadError("The file is larger than the allowed size."));
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream), meter, createWriteStream(tmpPath));
    const fh = await open(tmpPath, "r");
    const head = Buffer.alloc(16);
    try { await fh.read(head, 0, 16, 0); } finally { await fh.close(); }
    const type = sniffType(head);
    if (!type || type.kind !== opts.kind) throw new DownloadError(`The downloaded file is not a valid ${opts.kind}.`);
    return { tmpPath, sha256: hash.digest("hex"), bytes, type };
  } catch (e) {
    await rm(tmpPath, { force: true });
    if (e instanceof DownloadError) throw e;
    throw new DownloadError("The download failed or was interrupted.");
  }
}
