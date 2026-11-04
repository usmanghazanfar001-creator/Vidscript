import { MapWrapper } from "../elements/MapWrapper";
import { SchematicMap } from "../elements/SchematicMap";
import type { MapVisual } from "../elements/mapGeometry";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

export const TradeRouteScene: React.FC<{ scene: Scene; visual: MapVisual; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <MapWrapper brand={brand} title={scene.title} subtitle={scene.subtitle} zoom={1.04}>
    <SchematicMap v={visual} brand={brand} variant="trade" />
  </MapWrapper>
);
