import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const CtaScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "callToAction" }>; brand: VidscriptPlan["brand"] }> = ({ visual, brand }) => {
  const frame = useCurrentFrame();
  const pill = useAppear(30, 14);
  const pulse = 1 + 0.025 * Math.sin(interpolate(frame, [0, 60], [0, Math.PI * 2], { extrapolateRight: "extend" }));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 40 }}>
      {brand.logoUrl ? <Img src={brand.logoUrl} style={{ height: 130 }} /> : null}
      <AnimatedHeading text={visual.text} color={brand.textColor} size={110} />
      {visual.url ? (
        <div style={{ opacity: pill, transform: `scale(${pulse})`, background: brand.accentColor, color: brand.backgroundColor, fontSize: 48, fontWeight: 800, padding: "18px 56px", borderRadius: 60 }}>{visual.url}</div>
      ) : null}
    </AbsoluteFill>
  );
};
