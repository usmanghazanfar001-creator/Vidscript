import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { readAudioDuration } from "@/lib/audio/duration";
import { ALLOWED_AUDIO_EXTENSIONS, MAX_VOICEOVER_BYTES, MIN_VOICEOVER_SECONDS, audioExtension, safeDisplayName } from "@/lib/audio/voiceover";
import { storageRoot } from "@/lib/storage/local";

export const runtime = "nodejs";
export const maxDuration = 300;

const MIME: Record<string, string> = { ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".aac": "audio/aac" };
const fileUrl = (projectId: string) => `/api/projects/${projectId}/voiceover/file`;

type Row = { fileName: string; sizeBytes: number; durationSeconds: number; uploadedAt: Date };
const view = (projectId: string, v: Row) => ({
  fileName: v.fileName, sizeBytes: v.sizeBytes, durationSeconds: v.durationSeconds, uploadedAt: v.uploadedAt.toISOString(), url: fileUrl(projectId),
});

async function ownProject(projectId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId: requireUserId() }, select: { id: true } });
}
const unauthorized = (e: unknown) => (e instanceof UnauthorizedError ? NextResponse.json({ error: e.message }, { status: 401 }) : null);

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const v = await prisma.voiceover.findUnique({ where: { projectId: project.id } });
    return NextResponse.json({ voiceover: v ? view(project.id, v) : null });
  } catch (e) {
    return unauthorized(e) ?? NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * Upload or replace the voiceover. The request body is the raw file (streamed to disk, never held in memory);
 * the file name goes in ?name=. The server reads the real duration itself.
 */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  let abs: string | null = null;
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const q = new URL(req.url).searchParams;
    const name = safeDisplayName(q.get("name") ?? "");
    const ext = audioExtension(name);
    if (!ext) return NextResponse.json({ error: `Unsupported file type. Use ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}.` }, { status: 415 });
    if (Number(req.headers.get("content-length")) > MAX_VOICEOVER_BYTES) return NextResponse.json({ error: "File is too large (limit 300 MB)." }, { status: 413 });
    if (!req.body) return NextResponse.json({ error: "No file received" }, { status: 400 });

    const key = `projects/${project.id}/voiceover-${Date.now()}${ext}`;
    abs = path.join(storageRoot(), key);
    await mkdir(path.dirname(abs), { recursive: true });

    let bytes = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        bytes += chunk.length;
        bytes > MAX_VOICEOVER_BYTES ? cb(new Error("TOO_LARGE")) : cb(null, chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(req.body as unknown as import("node:stream/web").ReadableStream), limiter, createWriteStream(abs));
    } catch (e) {
      await rm(abs, { force: true });
      return e instanceof Error && e.message === "TOO_LARGE"
        ? NextResponse.json({ error: "File is too large (limit 300 MB)." }, { status: 413 })
        : NextResponse.json({ error: "The upload was interrupted. Please retry." }, { status: 400 });
    }
    if (bytes === 0) { await rm(abs, { force: true }); return NextResponse.json({ error: "The file is empty." }, { status: 400 }); }

    // The server's reading of the real audio is the source of truth. The browser's measurement is only a fallback
    // for containers without a duration (some raw .aac streams).
    let duration: number | null = null;
    try { duration = await readAudioDuration(abs); } catch { /* not readable as media */ }
    if (duration == null) {
      const hint = z.coerce.number().positive().safeParse(q.get("durationHint"));
      if (hint.success) duration = hint.data;
    }
    if (duration == null || duration < MIN_VOICEOVER_SECONDS) {
      await rm(abs, { force: true });
      return NextResponse.json({ error: "Could not read the duration of this audio file. Export it as MP3, WAV or M4A and try again." }, { status: 422 });
    }

    const existing = await prisma.voiceover.findUnique({ where: { projectId: project.id } });
    const data = { url: fileUrl(project.id), fileName: name, sizeBytes: bytes, durationSeconds: duration, storageKey: key, mimeType: MIME[ext]!, uploadedAt: new Date() };
    const row = await prisma.voiceover.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...data }, update: data });
    if (existing?.storageKey) await rm(path.join(storageRoot(), existing.storageKey), { force: true });
    abs = null;
    return NextResponse.json({ voiceover: view(project.id, row) }, { status: 201 });
  } catch (e) {
    if (abs) await rm(abs, { force: true }).catch(() => {});
    console.error(e);
    return unauthorized(e) ?? NextResponse.json({ error: "Upload failed. Please retry." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const v = await prisma.voiceover.findUnique({ where: { projectId: project.id } });
    if (v) {
      await prisma.voiceover.delete({ where: { projectId: project.id } });
      if (v.storageKey) await rm(path.join(storageRoot(), v.storageKey), { force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return unauthorized(e) ?? NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
