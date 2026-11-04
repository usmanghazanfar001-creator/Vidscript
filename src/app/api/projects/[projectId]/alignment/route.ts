import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { loadCaptionView } from "@/lib/db/captions";
import { loadLatestPlan, loadPlanVersion } from "@/lib/db/storyboards";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { groqCompleter, GroqConfigError } from "@/lib/ai/groq";
import { describeGroqError } from "@/lib/ai/groqErrors";
import { AlignmentError, suggestRealignment } from "@/lib/ai/realign";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({ method: z.literal("ai"), storyboardVersion: z.number().int().positive().nullish() });

/**
 * AI-assisted realignment. Proportional stretch and manual editing happen in the editor itself.
 * This route only SUGGESTS new scene boundaries (nothing is saved); the user approves before they are applied.
 */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await prisma.project.findFirst({ where: { id: params.projectId, userId: requireUserId() }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const body = bodySchema.parse(await req.json().catch(() => null));

    const version = body.storyboardVersion ?? (await loadLatestPlan(project.id))?.version ?? null;
    const plan = version == null ? null : await loadPlanVersion(project.id, version);
    if (!plan || version == null) return NextResponse.json({ error: "Generate and save a storyboard first." }, { status: 400 });

    const voiceover = await prisma.voiceover.findUnique({ where: { projectId: project.id }, select: { durationSeconds: true } });
    if (!voiceover) return NextResponse.json({ error: "Upload your voiceover first." }, { status: 400 });
    const captions = await loadCaptionView(project.id);
    if (!captions || captions.cues.length === 0) return NextResponse.json({ error: "Upload your Lafzaly captions first, so the AI can see when each part is spoken." }, { status: 400 });
    if (captions.validation.status === "invalid") return NextResponse.json({ error: "Fix the problems in the caption file before using AI realignment." }, { status: 400 });

    const result = await suggestRealignment({ plan, cues: captions.cues, durationSeconds: voiceover.durationSeconds }, groqCompleter());
    return NextResponse.json({
      storyboardVersion: version, durationSeconds: voiceover.durationSeconds, rationale: result.rationale,
      scenes: result.scenes.map((s) => ({ id: s.id, startSeconds: s.startSeconds, endSeconds: s.endSeconds })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    if (err instanceof GroqConfigError) return NextResponse.json({ error: err.message }, { status: 500 });
    if (err instanceof AlignmentError) return NextResponse.json({ error: err.message, retryable: true }, { status: 502 });
    const groq = describeGroqError(err);
    if (groq) return NextResponse.json({ error: groq.message, retryable: groq.retryable }, { status: 502 });
    console.error("alignment failed", err);
    return NextResponse.json({ error: "Realignment failed. Please retry.", retryable: true }, { status: 502 });
  }
}
