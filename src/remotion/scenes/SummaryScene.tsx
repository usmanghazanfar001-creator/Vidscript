import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const SummaryScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "bulletList" | "checklist" }>; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 54 }}>
    <AnimatedHeading text={scene.title} color={brand.textColor} size={80} />
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {visual.items.map((item, i) => <Takeaway key={i} text={item} index={i} brand={brand} />)}
    </div>
  </AbsoluteFill>
);

const Takeaway: React.FC<{ text: string; index: number; brand: VidscriptPlan["brand"] }> = ({ text, index, brand }) => {
  const a = useAppear(24 + index * 14, 14);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: a, transform: `translateX(${(1 - a) * -50}px)` }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: brand.accentColor, color: brand.backgroundColor, fontSize: 38, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{index + 1}</div>
      <div style={{ fontSize: 52, color: brand.textColor }}>{text}</div>
    </div>
  );
};
