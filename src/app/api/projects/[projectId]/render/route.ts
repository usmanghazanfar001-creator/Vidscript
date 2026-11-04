import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { loadLatestPlan, loadPlanVersion } from "@/lib/db/storyboards";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { createRender } from "@/lib/render/jobs";

export const runtime = "nodejs";

const bodySchema = z.object({ storyboardVersion: z.number().int().positive().nullish() });

export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const userId = requireUserId();
    const project = await prisma.project.findFirst({ where: { id: params.projectId, userId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    let version = body.storyboardVersion ?? null;
    let plan;
    if (version == null) {
      const latest = await loadLatestPlan(project.id);
      version = latest?.version ?? null;
      plan = latest?.plan ?? null;
    } else {
      plan = await loadPlanVersion(project.id, version);
    }
    if (!plan || version == null) return NextResponse.json({ error: "Generate and save a storyboard before rendering." }, { status: 400 });
    if (plan.mode !== "silent-draft") return NextResponse.json({ error: "Final renders with voiceover are not available yet." }, { status: 400 });

    const id = await createRender(project.id, version);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Could not start the render. Please retry." }, { status: 500 });
  }
}
