import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const AnimatedBullets: React.FC<{ items: string[]; color: string; accent: string; startFrame?: number }> = ({ items, color, accent, startFrame = 24 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 28 }}>
      {items.map((item, i) => {
        const p = spring({ frame: frame - startFrame - i * 14, fps, config: { damping: 200 } });
        return (
          <li key={i} style={{ display: "flex", gap: 24, alignItems: "center", color, fontSize: 52, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-50, 0])}px)` }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: accent, flexShrink: 0 }} />
            {item}
          </li>
        );
      })}
    </ul>
  );
};
