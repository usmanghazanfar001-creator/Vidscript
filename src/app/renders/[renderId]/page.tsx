import { notFound } from "next/navigation";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { findOwnedRender, reconcile } from "@/lib/render/jobs";
import { RenderStatus } from "@/components/render/RenderStatus";

export const dynamic = "force-dynamic";

export default async function RenderPage({ params }: { params: { renderId: string } }) {
  let userId: string;
  try { userId = requireUserId(); } catch (e) {
    if (e instanceof UnauthorizedError) return <main className="p-10 text-white/70">{e.message}</main>;
    throw e;
  }
  const found = await findOwnedRender(params.renderId, userId);
  if (!found) notFound();
  const job = await reconcile(found);
  return (
    <RenderStatus
      initial={{
        id: job.id, projectId: job.projectId, projectTitle: found.project.title, status: job.status, progress: Math.round(job.progress),
        outputUrl: job.outputUrl, errorMessage: job.errorMessage, storyboardVersion: job.storyboardVersion,
        startedAt: job.startedAt?.toISOString() ?? null, completedAt: job.completedAt?.toISOString() ?? null,
      }}
    />
  );
}
