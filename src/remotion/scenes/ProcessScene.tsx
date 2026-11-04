import { AbsoluteFill } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { StepDiagram } from "../elements/StepDiagram";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

export const ProcessScene: React.FC<{ scene: Scene; visual: Extract<Visual, { kind: "stepDiagram" }>; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <AbsoluteFill style={{ padding: "0 110px", justifyContent: "center", gap: 90 }}>
    <AnimatedHeading text={scene.title} color={brand.textColor} size={72} />
    <StepDiagram steps={visual.steps} brand={brand} />
  </AbsoluteFill>
);
