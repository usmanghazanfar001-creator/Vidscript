import type { Scene } from "@/remotion/schemas/vidscriptSchema";
import { round3 } from "./duration";

/** Scales every scene proportionally so the timeline ends at targetSeconds. Never mutates input. */
export function proportionalStretch(scenes: Scene[], targetSeconds: number): Scene[] {
  if (scenes.length === 0) return [];
  const currentEnd = scenes[scenes.length - 1]!.endSeconds;
  if (currentEnd <= 0 || targetSeconds <= 0) throw new RangeError("Durations must be positive");
  const ratio = targetSeconds / currentEnd;
  return scenes.map((s, i) => ({
    ...s,
    startSeconds: round3(s.startSeconds * ratio),
    endSeconds: i === scenes.length - 1 ? round3(targetSeconds) : round3(s.endSeconds * ratio),
  }));
}

/** Moves the boundary between scene[index] and scene[index+1]; prevents overlap and tiny scenes. */
export function moveBoundary(scenes: Scene[], index: number, newSeconds: number, minSceneSeconds = 1.5): Scene[] {
  const a = scenes[index];
  const b = scenes[index + 1];
  if (!a || !b) throw new RangeError("No boundary at that index");
  const clamped = Math.min(Math.max(newSeconds, a.startSeconds + minSceneSeconds), b.endSeconds - minSceneSeconds);
  return scenes.map((s, i) =>
    i === index ? { ...s, endSeconds: round3(clamped) } : i === index + 1 ? { ...s, startSeconds: round3(clamped) } : s,
  );
}
