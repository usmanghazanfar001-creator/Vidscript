import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const AnimatedHeading: React.FC<{ text: string; color: string; size?: number; delay?: number }> = ({ text, color, size = 96, delay = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <h1 style={{ color, fontSize: size, fontWeight: 800, lineHeight: 1.1, margin: 0, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)` }}>
      {text}
    </h1>
  );
};
