import type { Scene, VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";

/**
 * Turns a plan into a final-render plan whose master timeline is the real voiceover.
 * The silent-draft estimate is kept for reference; the voiceover duration is the source of truth.
 */
export function toFinalRenderPlan(
  plan: VidscriptPlan,
  opts: { scenes: Scene[]; durationSeconds: number; voiceoverUrl: string; captionsUrl: string | null },
): VidscriptPlan {
  return { ...plan, mode: "final-render", actualDurationSeconds: opts.durationSeconds, voiceoverUrl: opts.voiceoverUrl, captionsUrl: opts.captionsUrl, scenes: opts.scenes };
}

/** Snaps a time to the nearest caption start within `windowSeconds`, otherwise returns it unchanged. */
export function snapToCues(seconds: number, cueStarts: number[], windowSeconds = 0.4): number {
  let best = seconds, bestDist = windowSeconds;
  for (const c of cueStarts) {
    const d = Math.abs(c - seconds);
    if (d <= bestDist) { best = c; bestDist = d; }
  }
  return best;
}
