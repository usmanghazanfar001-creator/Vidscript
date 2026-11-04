import { MapWrapper } from "../elements/MapWrapper";
import { SchematicMap } from "../elements/SchematicMap";
import { MAP_H, MAP_W, type MapVisual } from "../elements/mapGeometry";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

/** Side-by-side: the same layout neutral ("before") and then highlighted with routes ("after"). */
export const BeforeAfterMapScene: React.FC<{ scene: Scene; visual: MapVisual; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <MapWrapper brand={brand} title={scene.title} subtitle={scene.subtitle} zoom={1.02}>
    <g transform={`translate(0 170) scale(0.5)`}>
      <SchematicMap v={visual} brand={brand} variant="before" />
    </g>
    <g transform={`translate(${MAP_W / 2} 170) scale(0.5)`}>
      <SchematicMap v={visual} brand={brand} variant="after" startFrame={50} />
    </g>
    <line x1={MAP_W / 2} x2={MAP_W / 2} y1={190} y2={MAP_H - 40} stroke={brand.textColor} strokeOpacity={0.3} strokeDasharray="10 10" />
    <text x={MAP_W / 4} y={MAP_H - 30} textAnchor="middle" fontSize={34} fontWeight={700} fill={brand.textColor}>Before</text>
    <text x={(MAP_W * 3) / 4} y={MAP_H - 30} textAnchor="middle" fontSize={34} fontWeight={700} fill={brand.accentColor}>After</text>
  </MapWrapper>
);
