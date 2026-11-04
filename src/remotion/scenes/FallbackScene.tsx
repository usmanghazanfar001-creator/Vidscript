import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

/** Shown only when a scene's visual kind does not fit its type (the editor prevents this; old data might not). */
export const FallbackScene: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => (
  <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 20 }}>
    <AnimatedHeading text={scene.title} color={brand.textColor} size={84} />
    {scene.subtitle ? <p style={{ fontSize: 44, color: brand.accentColor, margin: 0 }}>{scene.subtitle}</p> : null}
    <p style={{ fontSize: 28, color: brand.primaryColor, margin: 0 }}>[visual "{scene.visual.kind}" does not match scene type "{scene.type}"]</p>
  </AbsoluteFill>
);
