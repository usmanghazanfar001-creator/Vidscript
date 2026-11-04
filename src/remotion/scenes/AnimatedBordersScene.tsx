import { AbsoluteFill } from "remotion";
import { MapWrapper } from "../elements/MapWrapper";
import { SchematicMap } from "../elements/SchematicMap";
import { useAppear } from "../elements/anim";
import type { MapVisual } from "../elements/mapGeometry";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

export const AnimatedBordersScene: React.FC<{ scene: Scene; visual: MapVisual; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <AbsoluteFill>
    <MapWrapper brand={brand} title={scene.title} subtitle={scene.subtitle}>
      <SchematicMap v={visual} brand={brand} variant="borders" />
    </MapWrapper>
    <div style={{ position: "absolute", right: 80, bottom: 70, width: 560, display: "flex", flexDirection: "column", gap: 14 }}>
      {visual.borderChanges.map((c, i) => <Change key={i} year={c.year} label={c.label} index={i} brand={brand} />)}
    </div>
  </AbsoluteFill>
);

const Change: React.FC<{ year: string | null; label: string; index: number; brand: VidscriptPlan["brand"] }> = ({ year, label, index, brand }) => {
  const a = useAppear(50 + index * 24, 14);
  return (
    <div style={{ opacity: a, transform: `translateX(${(1 - a) * 40}px)`, background: `${brand.backgroundColor}ee`, borderLeft: `8px solid ${brand.accentColor}`, padding: "12px 20px", color: brand.textColor, fontSize: 32 }}>
      {year ? <strong style={{ color: brand.accentColor }}>{year} </strong> : null}{label}
    </div>
  );
};
