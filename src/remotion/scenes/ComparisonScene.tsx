import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { ComparisonCard } from "../elements/ComparisonCard";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const ComparisonScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "twoColumnComparison" }>; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => {
  const vs = useAppear(26, 12);
  const [a, b] = visual.columns;
  return (
    <AbsoluteFill style={{ padding: "70px 130px", gap: 44 }}>
      <AnimatedHeading text={scene.title} color={brand.textColor} size={64} />
      <div style={{ flex: 1, display: "flex", alignItems: "stretch", gap: 36, position: "relative" }}>
        <ComparisonCard heading={a.heading} points={a.points} side="left" color={brand.primaryColor} brand={brand} />
        <ComparisonCard heading={b.heading} points={b.points} side="right" color={brand.accentColor} brand={brand} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${vs})`, width: 90, height: 90, borderRadius: 45, background: brand.backgroundColor, border: `4px solid ${brand.textColor}`, color: brand.textColor, fontSize: 36, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>VS</div>
      </div>
    </AbsoluteFill>
  );
};
