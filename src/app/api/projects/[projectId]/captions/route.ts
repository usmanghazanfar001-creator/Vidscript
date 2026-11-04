import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { loadCaptionView } from "@/lib/db/captions";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { parseCaptions, validateCues } from "@/lib/captions/parse";
import { CAPTION_PRESETS } from "@/lib/captions/presets";
import { safeDisplayName } from "@/lib/audio/voiceover";
import { storageRoot } from "@/lib/storage/local";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

const ownProject = (projectId: string) => prisma.project.findFirst({ where: { id: projectId, userId: requireUserId() }, select: { id: true } });
function fail(e: unknown) {
  if (e instanceof UnauthorizedError) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please retry." }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ captions: await loadCaptionView(project.id) });
  } catch (e) { return fail(e); }
}

/**
 * Upload or replace the Lafzaly caption file. The body is the raw file; the name goes in ?name=.
 * The original bytes are stored untouched. Vidscript never edits caption text or timing.
 */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  let abs: string | null = null;
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const name = safeDisplayName(new URL(req.url).searchParams.get("name") ?? "");
    const ext = name.toLowerCase().endsWith(".srt") ? ".srt" : name.toLowerCase().endsWith(".vtt") ? ".vtt" : null;
    if (!ext) return NextResponse.json({ error: "Unsupported file type. Use a Lafzaly .srt (preferred) or .vtt export." }, { status: 415 });
    if (Number(req.headers.get("content-length")) > MAX_BYTES) return NextResponse.json({ error: "Caption file is too large (limit 5 MB)." }, { status: 413 });

    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.length === 0) return NextResponse.json({ error: "The file is empty." }, { status: 400 });
    if (buf.length > MAX_BYTES) return NextResponse.json({ error: "Caption file is too large (limit 5 MB)." }, { status: 413 });
    const text = buf.toString("utf8");
    if (text.includes("\uFFFD")) return NextResponse.json({ error: "The file is not valid UTF-8. Re-export it from Lafzaly as UTF-8." }, { status: 422 });

    const format = ext === ".srt" ? "srt" : "vtt";
    let cues;
    try { cues = parseCaptions(text, format); } catch (e) {
      return NextResponse.json({ error: `Could not read the captions: ${e instanceof Error ? e.message : "invalid format"}` }, { status: 422 });
    }
    if (cues.length === 0) return NextResponse.json({ error: "No captions were found in this file." }, { status: 422 });

    const vo = await prisma.voiceover.findUnique({ where: { projectId: project.id }, select: { durationSeconds: true } });
    const validation = validateCues(cues, vo?.durationSeconds ?? null);

    const key = `projects/${project.id}/captions-${Date.now()}${ext}`;
    abs = path.join(storageRoot(), key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buf); // byte-for-byte original

    const existing = await prisma.captionFile.findUnique({ where: { projectId: project.id } });
    const data = {
      url: `/api/projects/${project.id}/captions/file`, fileName: name, format: format === "srt" ? ("SRT" as const) : ("VTT" as const),
      cueCount: cues.length, validationStatus: validation.status, validationErrors: validation.errors, storageKey: key, uploadedAt: new Date(),
    };
    await prisma.captionFile.upsert({ where: { projectId: project.id }, create: { projectId: project.id, ...data }, update: data });
    if (existing?.storageKey) await rm(path.join(storageRoot(), existing.storageKey), { force: true });
    abs = null;
    return NextResponse.json({ captions: await loadCaptionView(project.id) }, { status: 201 });
  } catch (e) {
    if (abs) await rm(abs, { force: true }).catch(() => {});
    return fail(e);
  }
}

const patchSchema = z.object({ preset: z.enum(CAPTION_PRESETS).optional(), enabled: z.boolean().optional() }).refine((v) => v.preset !== undefined || v.enabled !== undefined, "Nothing to update");

export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const body = patchSchema.parse(await req.json().catch(() => null));
    const res = await prisma.captionFile.updateMany({ where: { projectId: project.id }, data: body });
    if (res.count === 0) return NextResponse.json({ error: "No caption file to update" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}

export async function DELETE(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const row = await prisma.captionFile.findUnique({ where: { projectId: project.id } });
    if (row) {
      await prisma.captionFile.delete({ where: { projectId: project.id } });
      if (row.storageKey) await rm(path.join(storageRoot(), row.storageKey), { force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
