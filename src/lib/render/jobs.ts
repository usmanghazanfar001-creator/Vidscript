import { makeCancelSignal } from "@remotion/renderer";
import type { RenderJob } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { loadPlanVersion } from "@/lib/db/storyboards";
import { ensureRenderDir, renderFilePath, writeRenderJson, writeRenderText, RENDER_FILES } from "@/lib/storage/local";
import { renderSilentDraft } from "./local";
import { creditsText, sceneTimingExport } from "./metadata";

type Globals = { __vsActive?: Map<string, { cancel: () => void }>; __vsPending?: Set<string>; __vsQueue?: Promise<void> };
const g = globalThis as unknown as Globals;
const active = (g.__vsActive ??= new Map());
const pending = (g.__vsPending ??= new Set());

const isLive = (id: string) => active.has(id) || pending.has(id);

/** Renders run one at a time in this process (local mode). Lambda mode comes in a later step. */
export function enqueueRender(jobId: string) {
  pending.add(jobId);
  g.__vsQueue = (g.__vsQueue ?? Promise.resolve()).then(() => runJob(jobId)).catch((e) => console.error("render queue error", e));
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const hint = /browser|chrom/i.test(msg) ? " (Remotion needs a Chrome browser; the first render downloads one, so check your connection.)" : "";
  return msg.slice(0, 500) + hint;
}

async function runJob(jobId: string) {
  pending.delete(jobId);
  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "QUEUED") return; // canceled while waiting

  const { cancelSignal, cancel } = makeCancelSignal();
  active.set(jobId, { cancel });
  let lastWrite = 0, lastPct = -1;
  try {
    const plan = job.storyboardVersion != null ? await loadPlanVersion(job.projectId, job.storyboardVersion) : null;
    if (!plan) throw new Error("The storyboard for this render could not be found");
    await prisma.renderJob.updateMany({ where: { id: jobId, status: "QUEUED" }, data: { status: "RENDERING", startedAt: new Date(), progress: 0 } });

    await ensureRenderDir(jobId);
    await renderSilentDraft(plan, renderFilePath(jobId, "draft.mp4"), {
      cancelSignal,
      onProgress: (f) => {
        const pct = Math.round(f * 100);
        const now = Date.now();
        if (pct === lastPct || (now - lastWrite < 1000 && pct < 100)) return;
        lastPct = pct; lastWrite = now;
        void prisma.renderJob.updateMany({ where: { id: jobId, status: "RENDERING" }, data: { progress: pct } }).catch(() => {});
      },
    });
    await writeRenderJson(jobId, "sceneTiming.json", sceneTimingExport(plan));
    await writeRenderJson(jobId, "storyboard.json", plan);
    await writeRenderText(jobId, "credits.txt", creditsText(plan));

    await prisma.renderJob.updateMany({
      where: { id: jobId, status: "RENDERING" },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date(), outputUrl: `/api/renders/${jobId}/file?name=draft.mp4`, outputFiles: [...RENDER_FILES] },
    });
  } catch (e) {
    // A user cancel already set CANCELED; updateMany on RENDERING/QUEUED leaves that alone.
    await prisma.renderJob.updateMany({
      where: { id: jobId, status: { in: ["QUEUED", "RENDERING"] } },
      data: { status: "FAILED", errorMessage: friendly(e), completedAt: new Date() },
    });
  } finally {
    active.delete(jobId);
  }
}

export async function cancelRender(jobId: string) {
  const res = await prisma.renderJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "RENDERING"] } },
    data: { status: "CANCELED", completedAt: new Date() },
  });
  if (res.count > 0) {
    active.get(jobId)?.cancel();
    pending.delete(jobId);
  }
}

/** If the server restarted mid-render, the job can never finish: mark it failed so the user can retry. */
export async function reconcile(job: RenderJob): Promise<RenderJob> {
  if ((job.status === "QUEUED" || job.status === "RENDERING") && !isLive(job.id)) {
    return prisma.renderJob.update({
      where: { id: job.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: "This render was interrupted (the server restarted). Please retry." },
    });
  }
  return job;
}

export async function createRender(projectId: string, storyboardVersion: number) {
  const job = await prisma.renderJob.create({ data: { projectId, mode: "SILENT_DRAFT", storyboardVersion }, select: { id: true } });
  enqueueRender(job.id);
  return job.id;
}

export async function findOwnedRender(renderId: string, userId: string) {
  return prisma.renderJob.findFirst({ where: { id: renderId, project: { userId } }, include: { project: { select: { title: true } } } });
}
