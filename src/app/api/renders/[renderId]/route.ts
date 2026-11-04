import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { cancelRender, createRender, findOwnedRender, reconcile } from "@/lib/render/jobs";

export const runtime = "nodejs";

const view = (j: Awaited<ReturnType<typeof reconcile>>) => ({
  id: j.id, projectId: j.projectId, status: j.status, progress: j.progress, outputUrl: j.outputUrl,
  errorMessage: j.errorMessage, startedAt: j.startedAt, completedAt: j.completedAt, storyboardVersion: j.storyboardVersion,
});

function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please retry." }, { status: 500 });
}

export async function GET(_req: Request, { params }: { params: { renderId: string } }) {
  try {
    const job = await findOwnedRender(params.renderId, requireUserId());
    if (!job) return NextResponse.json({ error: "Render not found" }, { status: 404 });
    return NextResponse.json(view(await reconcile(job)));
  } catch (err) { return fail(err); }
}

export async function POST(req: Request, { params }: { params: { renderId: string } }) {
  try {
    const { action } = z.object({ action: z.enum(["cancel", "retry"]) }).parse(await req.json().catch(() => null));
    const job = await findOwnedRender(params.renderId, requireUserId());
    if (!job) return NextResponse.json({ error: "Render not found" }, { status: 404 });

    if (action === "cancel") {
      await cancelRender(job.id);
      const fresh = await findOwnedRender(job.id, requireUserId());
      return NextResponse.json(view(fresh!));
    }
    if (job.status !== "FAILED" && job.status !== "CANCELED") return NextResponse.json({ error: "Only failed or canceled renders can be retried." }, { status: 409 });
    if (job.storyboardVersion == null) return NextResponse.json({ error: "This render has no storyboard to retry." }, { status: 409 });
    return NextResponse.json({ id: await createRender(job.projectId, job.storyboardVersion) }, { status: 201 });
  } catch (err) { return fail(err); }
}
