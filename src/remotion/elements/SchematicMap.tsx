import { interpolate, useCurrentFrame } from "remotion";
import { blobPath, controlPoint, quadPoint, resolvePoints, terrainOf, type MapVisual, type Pt } from "./mapGeometry";
import { useAppear } from "./anim";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

export type MapVariant = "default" | "before" | "after" | "borders" | "terrain" | "trade";

/**
 * Schematic (not geographic) map: regions are stylised shapes placed by a deterministic layout,
 * labels use their given x/y, routes are animated curves. It shows structure and sequence, not true borders.
 */
export const SchematicMap: React.FC<{ v: MapVisual; brand: VidscriptPlan["brand"]; variant?: MapVariant; startFrame?: number }> = ({ v, brand, variant = "default", startFrame = 10 }) => {
  const frame = useCurrentFrame();
  const pts = resolvePoints(v);
  const radius = v.regions.length > 6 ? 95 : 125;
  const showRoutes = variant !== "before";
  const routeStart = startFrame + v.regions.length * 8 + 14;
  const labelStart = startFrame + v.regions.length * 8 + 6;

  return (
    <g>
      {v.regions.map((r, i) => {
        const p = pts[r.name]!;
        const a = interpolate(frame, [startFrame + i * 8, startFrame + i * 8 + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const lit = r.highlight && variant !== "before";
        const d = blobPath(p, radius, r.name);
        const borders = variant === "borders";
        return (
          <g key={r.name} opacity={a} transform={`translate(${p.x} ${p.y}) scale(${0.9 + 0.1 * a}) translate(${-p.x} ${-p.y})`}>
            <path d={d} fill={borders ? "none" : lit ? brand.accentColor : brand.primaryColor} fillOpacity={lit ? 0.5 : 0.22} stroke={lit ? brand.accentColor : brand.primaryColor} strokeWidth={borders ? 5 : 3}
              {...(borders ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - a } : {})} />
            {variant === "terrain" ? <Terrain name={r.name} at={p} color={brand.textColor} /> : null}
            <text x={p.x} y={p.y + 10} textAnchor="middle" fontSize={32} fontWeight={700} fill={brand.textColor}>{r.name}</text>
          </g>
        );
      })}

      {v.labels.map((l, i) => {
        const a = interpolate(frame, [labelStart + i * 6, labelStart + i * 6 + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <g key={`l-${l.text}`} opacity={a}>
            <circle cx={pts[l.text]!.x} cy={pts[l.text]!.y} r={9} fill={brand.accentColor} />
            {variant === "terrain" ? <Terrain name={l.text} at={pts[l.text]!} color={brand.textColor} /> : null}
            <text x={pts[l.text]!.x + 18} y={pts[l.text]!.y + 8} fontSize={28} fill={brand.textColor}>{l.text}</text>
          </g>
        );
      })}

      {showRoutes ? v.routes.map((r, i) => <Route key={`${r.from}-${r.to}-${i}`} a={pts[r.from]!} b={pts[r.to]!} label={r.label} color={brand.accentColor} text={brand.textColor} start={routeStart + i * 14} thick={variant === "trade"} />) : null}
    </g>
  );
};

const Route: React.FC<{ a: Pt; b: Pt; label: string | null; color: string; text: string; start: number; thick: boolean }> = ({ a, b, label, color, text, start, thick }) => {
  const draw = useAppear(start, 36);
  const c = controlPoint(a, b);
  const dot = quadPoint(a, c, b, draw);
  const mid = quadPoint(a, c, b, 0.5);
  return (
    <g>
      <path d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`} fill="none" stroke={color} strokeWidth={thick ? 9 : 6} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} opacity={0.9} />
      {draw > 0 ? <circle cx={dot.x} cy={dot.y} r={thick ? 15 : 12} fill={color} /> : null}
      {label ? <text x={mid.x} y={mid.y - 18} textAnchor="middle" fontSize={26} fill={text} opacity={draw}>{label}</text> : null}
    </g>
  );
};

/** Simple glyphs chosen from keywords in the name (mountain, river, desert, water). */
const Terrain: React.FC<{ name: string; at: Pt; color: string }> = ({ name, at, color }) => {
  const kind = terrainOf(name);
  if (!kind) return null;
  const { x, y } = at;
  const s = { fill: "none", stroke: color, strokeOpacity: 0.7, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "mountain") return <g {...s}><path d={`M${x - 70},${y - 20} l35,-60 l35,60 M${x - 10},${y - 20} l45,-80 l45,80`} /></g>;
  if (kind === "river") return <g {...s}><path d={`M${x - 90},${y - 55} q30,-30 60,0 t60,0 t60,0`} /></g>;
  if (kind === "desert") return <g fill={color} fillOpacity={0.5}>{[-50, -10, 30, -30, 10].map((dx, i) => <circle key={i} cx={x + dx} cy={y - 55 - (i % 2) * 18} r={4} />)}</g>;
  return <g {...s}><path d={`M${x - 80},${y - 60} q20,-16 40,0 t40,0 t40,0`} /><path d={`M${x - 60},${y - 38} q20,-16 40,0 t40,0`} /></g>;
};
