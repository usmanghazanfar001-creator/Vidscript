import { AbsoluteFill, useCurrentFrame } from "remotion";
import { AnimatedHeading } from "../elements/AnimatedHeading";
import { ProgressIndicator } from "../elements/ProgressIndicator";
import { useAppear } from "../elements/anim";
import type { Scene, VidscriptPlan, Visual } from "../schemas/vidscriptSchema";

const ROW = 130;
type V = Extract<Visual, { kind: "timeline" }>;

export const TimelineScene: React.FC<{ scene: Scene; visual: V; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => {
  const frame = useCurrentFrame();
  const n = visual.events.length;
  const height = n * ROW;
  const progress = Math.min(1, Math.max(0, (frame - 20) / (n * 18)));
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 100 }}>
      <div style={{ flex: 1 }}>
        <AnimatedHeading text={scene.title} color={brand.textColor} size={78} />
        {scene.subtitle ? <p style={{ fontSize: 40, color: brand.accentColor, marginTop: 20 }}>{scene.subtitle}</p> : null}
      </div>
      <div style={{ flex: 1.2, position: "relative", height, paddingLeft: 50 }}>
        <ProgressIndicator progress={progress} color={brand.accentColor} track={`${brand.textColor}22`} height={height} />
        {visual.events.map((e, i) => <Event key={i} date={e.date} label={e.label} index={i} brand={brand} />)}
      </div>
    </AbsoluteFill>
  );
};

const Event: React.FC<{ date: string; label: string; index: number; brand: VidscriptPlan["brand"] }> = ({ date, label, index, brand }) => {
  const a = useAppear(20 + index * 18, 14);
  return (
    <div style={{ position: "absolute", top: index * ROW, left: 50, right: 0, height: ROW, opacity: a, transform: `translateX(${(1 - a) * 40}px)` }}>
      <div style={{ position: "absolute", left: -61, top: 10, width: 28, height: 28, borderRadius: 14, background: brand.accentColor }} />
      <div style={{ fontSize: 40, fontWeight: 800, color: brand.accentColor }}>{date}</div>
      <div style={{ fontSize: 40, color: brand.textColor }}>{label}</div>
    </div>
  );
};
