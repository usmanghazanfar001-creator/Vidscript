import { AbsoluteFill } from "remotion";
import { AnimatedChart } from "../elements/AnimatedChart";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

type V = Extract<Visual, { kind: "lineChart" | "barChart" | "donutChart" }>;
export const ChartScene: React.FC<{ scene: Scene; visual: V; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <AbsoluteFill style={{ padding: "70px 150px", gap: 20 }}>
    <AnimatedHeading text={scene.title} color={brand.textColor} size={68} />
    {scene.subtitle ? <p style={{ margin: 0, fontSize: 34, color: brand.accentColor }}>{scene.subtitle}</p> : null}
    <div style={{ flex: 1, minHeight: 0 }}>
      <AnimatedChart kind={visual.kind} data={visual.data} unit={visual.unit} brand={brand} />
    </div>
  </AbsoluteFill>
);
