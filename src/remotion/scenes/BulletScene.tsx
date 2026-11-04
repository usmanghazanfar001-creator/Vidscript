import { AbsoluteFill } from "remotion";
import { AnimatedBullets } from "../elements/AnimatedBullets";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

export const BulletScene: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => {
  const items = scene.visual.kind === "bulletList" || scene.visual.kind === "checklist" ? scene.visual.items : [];
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 56 }}>
      <AnimatedHeading text={scene.title} color={brand.textColor} size={80} />
      <AnimatedBullets items={items} color={brand.textColor} accent={brand.accentColor} />
    </AbsoluteFill>
  );
};
