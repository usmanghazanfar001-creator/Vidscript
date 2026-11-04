import { MapWrapper } from "../elements/MapWrapper";
import { SchematicMap } from "../elements/SchematicMap";
import type { MapVisual } from "../elements/mapGeometry";
import type { Scene, VidscriptPlan } from "../schemas/vidscriptSchema";

/** Mountains, rivers, deserts and coastlines are drawn from keywords in region/label names. */
export const TerrainMapScene: React.FC<{ scene: Scene; visual: MapVisual; brand: VidscriptPlan["brand"] }> = ({ scene, visual, brand }) => (
  <MapWrapper brand={brand} title={scene.title} subtitle={scene.subtitle}>
    <SchematicMap v={visual} brand={brand} variant="terrain" />
  </MapWrapper>
);
