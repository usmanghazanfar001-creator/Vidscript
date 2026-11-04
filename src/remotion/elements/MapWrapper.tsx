import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedHeading } from "./AnimatedHeading";
import { MAP_H, MAP_W } from "./mapGeometry";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

/** Shared stage for every map scene: heading, graticule, and a slow zoom/pan so the map never sits dead still. */
export const MapWrapper: React.FC<{
  brand: VidscriptPlan["brand"];
  title: string;
  subtitle?: string | null;
  zoom?: number;
  children: React.ReactNode;
}> = ({ brand, title, subtitle, zoom = 1.06, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const scale = 1 + (zoom - 1) * t;
  const panX = -20 * t;
  return (
    <AbsoluteFill>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g transform={`translate(${MAP_W / 2 + panX} ${MAP_H / 2}) scale(${scale}) translate(${-MAP_W / 2} ${-MAP_H / 2})`}>
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1={0} x2={MAP_W} y1={(i + 1) * 90} y2={(i + 1) * 90} stroke={brand.textColor} strokeOpacity={0.06} />
          ))}
          {Array.from({ length: 15 }, (_, i) => (
            <line key={`v${i}`} y1={0} y2={MAP_H} x1={(i + 1) * 100} x2={(i + 1) * 100} stroke={brand.textColor} strokeOpacity={0.06} />
          ))}
          {children}
        </g>
      </svg>
      <div style={{ position: "absolute", left: 90, top: 60, maxWidth: 1100 }}>
        <AnimatedHeading text={title} color={brand.textColor} size={68} />
        {subtitle ? <p style={{ margin: "10px 0 0", fontSize: 34, color: brand.accentColor }}>{subtitle}</p> : null}
      </div>
    </AbsoluteFill>
  );
};
