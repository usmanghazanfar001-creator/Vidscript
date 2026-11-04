import { AbsoluteFill } from "remotion";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const QuoteScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "quoteCard" }>; brand: VidscriptPlan["brand"] }> = ({ visual, brand }) => {
  const mark = useAppear(0, 14);
  const text = useAppear(10, 18);
  const who = useAppear(36, 14);
  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 220px" }}>
      <div style={{ fontSize: 260, lineHeight: 0.6, color: brand.accentColor, opacity: mark * 0.9, fontFamily: "Georgia, serif" }}>“</div>
      <p style={{ margin: "30px 0 0", fontSize: 66, lineHeight: 1.25, fontWeight: 600, color: brand.textColor, opacity: text, transform: `translateY(${(1 - text) * 30}px)` }}>{visual.quote}</p>
      {visual.attribution ? <p style={{ margin: "36px 0 0", fontSize: 38, color: brand.primaryColor, opacity: who }}>— {visual.attribution}</p> : null}
    </AbsoluteFill>
  );
};
