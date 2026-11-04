import type { VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import { OUTRO_ALLOWANCE_SECONDS } from "@/remotion/schemas/vidscriptSchema";
import { toFrames } from "@/lib/timing/duration";

/**
 * Master timeline length.
 * - silent-draft: estimated script duration.
 * - final-render: the real voiceover duration is the source of truth; the last scene
 *   may run up to OUTRO_ALLOWANCE_SECONDS past it for an outro.
 */
export function computeDurationSeconds(plan: Pick<VidscriptPlan, "mode" | "estimatedDurationSeconds" | "actualDurationSeconds" | "scenes">): number {
  const lastEnd = plan.scenes[plan.scenes.length - 1]?.endSeconds ?? 0;
  if (plan.mode === "silent-draft") {
    if (plan.estimatedDurationSeconds == null) throw new Error("estimatedDurationSeconds is required for silent drafts");
    return plan.estimatedDurationSeconds;
  }
  if (plan.actualDurationSeconds == null) throw new Error("actualDurationSeconds is required for final renders");
  return Math.min(Math.max(plan.actualDurationSeconds, lastEnd), plan.actualDurationSeconds + OUTRO_ALLOWANCE_SECONDS);
}

export function computeDurationInFrames(plan: Parameters<typeof computeDurationSeconds>[0], fps = 30): number {
  return toFrames(computeDurationSeconds(plan), fps);
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Plain-text credits for every stock photo/clip used, with source and licence, ready to paste into a video description. */
export function creditsText(plan: VidscriptPlan): string {
  const used = plan.scenes.map((s, i) => ({ s, i })).filter(({ s }) => s.assetId);
  const head = [`Stock media credits for "${plan.title}"`, "Include these where a licence asks for attribution (for example in the video description).", ""];
  if (used.length === 0) return [...head, "No stock media was used in this video."].join("\n") + "\n";
  const body = used.flatMap(({ s, i }) => [
    `Scene ${i + 1}: ${s.title} (${clock(s.startSeconds)}-${clock(s.endSeconds)})`,
    `  ${s.assetCredit ?? "Unknown source"}`,
    `  Licence: ${s.assetLicense ?? "unknown"}`,
    ...(s.assetSourceUrl ? [`  ${s.assetSourceUrl}`] : []),
    "",
  ]);
  return [...head, ...body].join("\n");
}

export function sceneTimingExport(plan: VidscriptPlan) {
  return {
    version: plan.version,
    title: plan.title,
    label: "SILENT DRAFT: align to your real voiceover before publishing",
    fps: plan.fps,
    wordsPerMinute: plan.wordsPerMinute,
    estimatedDurationSeconds: plan.estimatedDurationSeconds,
    scenes: plan.scenes.map((s) => ({ id: s.id, type: s.type, title: s.title, startSeconds: s.startSeconds, endSeconds: s.endSeconds })),
  };
}
