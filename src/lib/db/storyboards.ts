import type { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { vidscriptPlanSchema, type VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";

export async function ensureUser(id: string) {
  // Dev convenience until real auth exists: DEV_USER_ID need not exist beforehand.
  await prisma.user.upsert({ where: { id }, create: { id, email: `${id}@local.dev` }, update: {} });
}

export async function saveStoryboardVersion(projectId: string, plan: VidscriptPlan, source: "groq" | "manual" | "alignment", raw?: unknown) {
  return prisma.$transaction(async (tx) => {
    const last = await tx.storyboardVersion.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
    return tx.storyboardVersion.create({
      data: {
        projectId,
        version: (last?.version ?? 0) + 1,
        source,
        rawResponse: raw === undefined ? undefined : (raw as Prisma.InputJsonValue),
        plan: {
          create: {
            planJson: plan as unknown as Prisma.InputJsonValue,
            scenes: {
              create: plan.scenes.map((s, i) => ({
                position: i, startSeconds: s.startSeconds, endSeconds: s.endSeconds, type: s.type,
                dataJson: s as unknown as Prisma.InputJsonValue,
              })),
            },
          },
        },
      },
      select: { id: true, version: true },
    });
  });
}

export async function loadLatestPlan(projectId: string): Promise<{ version: number; plan: VidscriptPlan } | null> {
  const row = await prisma.storyboardVersion.findFirst({
    where: { projectId }, orderBy: { version: "desc" }, include: { plan: true },
  });
  if (!row?.plan) return null;
  const parsed = vidscriptPlanSchema.safeParse(row.plan.planJson);
  return parsed.success ? { version: row.version, plan: parsed.data } : null;
}

export async function loadPlanVersion(projectId: string, version: number): Promise<VidscriptPlan | null> {
  const row = await prisma.storyboardVersion.findUnique({ where: { projectId_version: { projectId, version } }, include: { plan: true } });
  if (!row?.plan) return null;
  const parsed = vidscriptPlanSchema.safeParse(row.plan.planJson);
  return parsed.success ? parsed.data : null;
}
