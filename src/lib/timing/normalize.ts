import type { Scene } from "@/remotion/schemas/vidscriptSchema";
import { proportionalBoundaries } from "./duration";

/**
 * Makes scene timings contiguous, non-overlapping and exactly targetSeconds long,
 * keeping the relative length of each scene from the model's proposal.
 * The model suggests the shape; this code guarantees the timeline rules.
 */
export function normalizeScenes(scenes: Scene[], targetSeconds: number): Scene[] {
  const sorted = [...scenes].sort((a, b) => a.startSeconds - b.startSeconds);
  const weights = sorted.map((s) => Math.max(0.1, s.endSeconds - s.startSeconds));
  const bounds = proportionalBoundaries(targetSeconds, weights);
  return sorted.map((s, i) => ({ ...s, startSeconds: bounds[i]!.start, endSeconds: bounds[i]!.end }));
}
