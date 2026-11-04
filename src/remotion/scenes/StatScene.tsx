import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

export const StatScene: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const v = scene.visual.kind === "statCallout" ? scene.visual : null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
      <div style={{ fontSize: 260, fontWeight: 900, color: brand.accentColor, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.92, 1])})` }}>{v?.value ?? scene.title}</div>
      <div style={{ fontSize: 60, color: brand.textColor }}>{v?.label ?? scene.subtitle}</div>
      {v?.context ? <div style={{ fontSize: 36, color: brand.primaryColor }}>{v.context}</div> : null}
    </AbsoluteFill>
  );
};
