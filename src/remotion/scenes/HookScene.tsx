import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

/** Large opening question, stat or problem statement. */
export const HookScene: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => {
  const stat = scene.visual.kind === "statCallout" ? scene.visual : null;
  const a = useAppear(22, 16);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 170px", gap: 30 }}>
      {stat ? <div style={{ fontSize: 200, fontWeight: 900, color: brand.accentColor, opacity: a, lineHeight: 1 }}>{stat.value}</div> : null}
      <AnimatedHeading text={scene.title} color={brand.textColor} size={stat ? 72 : 108} />
      {scene.subtitle || stat ? <p style={{ margin: 0, fontSize: 46, color: brand.primaryColor, opacity: a }}>{scene.subtitle ?? stat?.label}</p> : null}
    </AbsoluteFill>
  );
};
