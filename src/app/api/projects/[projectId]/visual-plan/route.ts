import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { saveStoryboardVersion } from "@/lib/db/storyboards";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { groqCompleter, GroqConfigError } from "@/lib/ai/groq";
import { describeGroqError } from "@/lib/ai/groqErrors";
import { generateVisualPlan, VisualPlanError } from "@/lib/ai/visualPlan";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const userId = requireUserId();
    const project = await prisma.project.findFirst({ where: { id: params.projectId, userId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const body: unknown = await req.json().catch(() => null);
    const { plan, raw } = await generateVisualPlan(body, groqCompleter());

    const saved = await saveStoryboardVersion(project.id, plan, "groq", raw);

    return NextResponse.json({ storyboardVersionId: saved.id, version: saved.version, plan });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    if (err instanceof GroqConfigError) return NextResponse.json({ error: err.message }, { status: 500 });
    if (err instanceof VisualPlanError) return NextResponse.json({ error: err.message, retryable: true }, { status: 502 });
    const groq = describeGroqError(err);
    if (groq) return NextResponse.json({ error: groq.message, retryable: groq.retryable }, { status: 502 });
    console.error("visual-plan failed", err);
    return NextResponse.json({ error: "Storyboard generation failed. Please retry.", retryable: true }, { status: 502 });
  }
}
