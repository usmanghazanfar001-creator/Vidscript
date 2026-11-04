import { useAppear } from "./anim";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

type Step = { label: string; detail: string | null };

export const StepDiagram: React.FC<{ steps: Step[]; brand: VidscriptPlan["brand"] }> = ({ steps, brand }) => (
  <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
    {steps.map((s, i) => (
      <StepItem key={i} step={s} index={i} last={i === steps.length - 1} brand={brand} />
    ))}
  </div>
);

const StepItem: React.FC<{ step: Step; index: number; last: boolean; brand: VidscriptPlan["brand"] }> = ({ step, index, last, brand }) => {
  const a = useAppear(24 + index * 16, 14);
  const arrow = useAppear(34 + index * 16, 14);
  return (
    <>
      <div style={{ flex: 1, minWidth: 0, textAlign: "center", opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>
        <div style={{ margin: "0 auto", width: 110, height: 110, borderRadius: 55, background: brand.accentColor, color: brand.backgroundColor, fontSize: 56, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</div>
        <div style={{ marginTop: 24, fontSize: 40, fontWeight: 700, color: brand.textColor, padding: "0 8px" }}>{step.label}</div>
        {step.detail ? <div style={{ marginTop: 10, fontSize: 28, color: brand.primaryColor, padding: "0 8px" }}>{step.detail}</div> : null}
      </div>
      {!last ? (
        <div style={{ width: 70, marginTop: 52, height: 6, background: brand.primaryColor, borderRadius: 3, flexShrink: 0, transformOrigin: "left", transform: `scaleX(${arrow})`, position: "relative" }}>
          <div style={{ position: "absolute", right: -4, top: -12, borderLeft: `20px solid ${brand.primaryColor}`, borderTop: "15px solid transparent", borderBottom: "15px solid transparent", opacity: arrow }} />
        </div>
      ) : null}
    </>
  );
};
