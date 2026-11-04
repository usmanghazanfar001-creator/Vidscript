import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** Slow, subtle gradient drift. Animates first so the scene never starts on a static frame. */
export const BackgroundMotion: React.FC<{ from: string; accent: string }> = ({ from, accent }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, 20], { extrapolateRight: "extend" });
  return (
    <AbsoluteFill
      style={{ background: `radial-gradient(circle at ${30 + drift}% ${40 + drift / 2}%, ${accent}22, transparent 55%), ${from}` }}
    />
  );
};
