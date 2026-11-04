import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db/client";
import { loadLatestPlan, saveStoryboardVersion } from "@/lib/db/storyboards";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { vidscriptPlanSchema } from "@/remotion/schemas/vidscriptSchema";

export const runtime = "nodejs";

async function ownProject(projectId: string) {
  const userId = requireUserId();
  return prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
}

function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) return NextResponse.json({ error: "The storyboard is not valid", issues: err.issues }, { status: 400 });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please retry." }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json((await loadLatestPlan(project.id)) ?? { version: null, plan: null });
  } catch (err) { return fail(err); }
}

/** Saves the user's edited storyboard as a NEW version; earlier versions are never overwritten. */
export async function PUT(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const project = await ownProject(params.projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const { plan } = z.object({ plan: vidscriptPlanSchema }).parse(await req.json().catch(() => null));
    const saved = await saveStoryboardVersion(project.id, plan, "manual");
    return NextResponse.json({ storyboardVersionId: saved.id, version: saved.version });
  } catch (err) { return fail(err); }
}
