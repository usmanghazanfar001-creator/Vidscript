import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

export const TitleScene: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 24 }}>
    <AnimatedHeading text={scene.title} color={brand.textColor} size={120} />
    {scene.subtitle ? <p style={{ fontSize: 48, color: brand.accentColor, margin: 0 }}>{scene.subtitle}</p> : null}
  </AbsoluteFill>
);
