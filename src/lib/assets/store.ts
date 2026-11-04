import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { storageRoot } from "@/lib/storage/local";
import { downloadToFile } from "./download";
import type { Candidate, StoredAsset } from "./types";

/** User ids become folder names, so anything unusual is neutralised first. */
const safeId = (userId: string) => userId.replace(/[^a-zA-Z0-9_-]/g, "_");
export const assetPath = (userId: string, storageKey: string) => path.join(storageRoot(), storageKey.startsWith(`assets/${safeId(userId)}/`) ? storageKey : "invalid");

type Row = Awaited<ReturnType<typeof prisma.mediaAsset.findFirstOrThrow>>;
const view = (r: Row): StoredAsset => ({
  id: r.id, provider: r.provider as StoredAsset["provider"], kind: r.kind as StoredAsset["kind"], credit: r.credit, license: r.license,
  pageUrl: r.pageUrl, width: r.width, height: r.height, durationSeconds: r.durationSeconds,
});

/**
 * Returns the cached copy when this user already has the asset (no download), otherwise downloads it once,
 * stores it under its content hash, and records where it came from and under which licence.
 */
export async function ensureAsset(userId: string, c: Candidate, query: string | null): Promise<StoredAsset> {
  const cacheKey = `${c.provider}:${c.providerId}:${c.kind}`;
  const existing = await prisma.mediaAsset.findUnique({ where: { userId_cacheKey: { userId, cacheKey } } });
  if (existing && (await stat(assetPath(userId, existing.storageKey)).catch(() => null))) return view(existing);

  const dir = path.join(storageRoot(), "assets", safeId(userId));
  const dl = await downloadToFile(c.downloadUrl, { dir, kind: c.kind, userAgent: process.env.ASSET_USER_AGENT });
  const storageKey = `assets/${safeId(userId)}/${dl.sha256}.${dl.type.ext}`;
  const finalPath = path.join(storageRoot(), storageKey);
  try {
    await mkdir(dir, { recursive: true });
    // Identical bytes from another provider/search are stored once.
    if (await stat(finalPath).catch(() => null)) await rm(dl.tmpPath, { force: true });
    else await rename(dl.tmpPath, finalPath);
  } catch (e) {
    await rm(dl.tmpPath, { force: true });
    throw e;
  }

  const data = {
    userId, cacheKey, provider: c.provider, providerId: c.providerId, kind: c.kind, query, storageKey, mimeType: dl.type.mime, sizeBytes: dl.bytes,
    sha256: dl.sha256, width: c.width, height: c.height, durationSeconds: c.durationSeconds, license: c.license, credit: c.credit, creditUrl: c.creditUrl, pageUrl: c.pageUrl,
  };
  const row = existing
    ? await prisma.mediaAsset.update({ where: { id: existing.id }, data })
    : await prisma.mediaAsset.create({ data });
  return view(row);
}
