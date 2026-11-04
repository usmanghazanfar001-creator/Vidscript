import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { loadLatestPlan } from "@/lib/db/storyboards";
import { loadCaptionView } from "@/lib/db/captions";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { StoryboardEditor } from "@/components/storyboard/StoryboardEditor";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  let userId: string;
  try { userId = requireUserId(); } catch (e) {
    if (e instanceof UnauthorizedError) return <main className="p-10 text-white/70">{e.message}</main>;
    throw e;
  }
  const project = await prisma.project.findFirst({ where: { id: params.projectId, userId }, include: { script: true } });
  if (!project || !project.script) notFound();
  const latest = await loadLatestPlan(project.id);
  const renderRows = await prisma.renderJob.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "desc" }, take: 10 });
  const captions = await loadCaptionView(project.id);
  const vo = await prisma.voiceover.findUnique({ where: { projectId: project.id } });
  const voiceover = vo ? { fileName: vo.fileName, sizeBytes: vo.sizeBytes, durationSeconds: vo.durationSeconds, uploadedAt: vo.uploadedAt.toISOString(), url: `/api/projects/${project.id}/voiceover/file` } : null;
  const renders = renderRows.map((r) => ({ id: r.id, status: r.status, progress: Math.round(r.progress), createdAt: r.createdAt.toISOString(), storyboardVersion: r.storyboardVersion }));

  return (
    <StoryboardEditor
      projectId={project.id}
      title={project.title}
      initial={latest}
      renders={renders}
      voiceover={voiceover}
      captions={captions}
      generate={{ script: project.script.originalText, visualStyle: project.visualStyle, wordsPerMinute: project.script.wordsPerMinute }}
    />
  );
}
