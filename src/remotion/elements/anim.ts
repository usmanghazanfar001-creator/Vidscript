import { Easing, interpolate, useCurrentFrame } from "remotion";

/** 0 -> 1 progress starting at `delay` frames, with a gentle ease-out. */
export function useAppear(delay = 0, duration = 16): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
