import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const ImageScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "imageWithCaption" }>; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: "clamp" });
  const cap = useAppear(20, 16);
  return (
    <AbsoluteFill>
      {scene.assetId ? null : scene.imageUrl ? (
        <Img src={scene.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
      ) : (
        <AbsoluteFill style={{ background: `linear-gradient(135deg, ${brand.primaryColor}55, ${brand.backgroundColor})`, transform: `scale(${zoom})` }} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent 55%)" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 120px 110px", gap: 14 }}>
        <AnimatedHeading text={scene.title} color={brand.textColor} size={80} />
        <p style={{ margin: 0, fontSize: 40, color: brand.textColor, opacity: cap * 0.9 }}>{visual.caption}</p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
