import { interpolate } from "remotion";
import { useAppear } from "./anim";
import { domain, donutSegments, formatValue, scaleY, seriesColor } from "./chartMath";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

type Point = { label: string; value: number };
const W = 1500, H = 620, L = 110, R = 40, T = 50, B = 110;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const AnimatedChart: React.FC<{
  kind: "lineChart" | "barChart" | "donutChart";
  data: Point[];
  unit: string | null;
  brand: VidscriptPlan["brand"];
}> = ({ kind, data, unit, brand }) => {
  const p = useAppear(16, 60); // progressive reveal, 0 -> 1
  const n = data.length;
  const d = domain(data.map((x) => x.value));
  const y0 = scaleY(0, d, T, H - B);
  const text = brand.textColor;

  if (kind === "donutChart") {
    const segs = donutSegments(data.map((x) => x.value));
    const total = data.reduce((a, x) => a + Math.abs(x.value), 0) || 1;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
        <g transform={`translate(380 ${H / 2}) rotate(-90)`}>
          {segs.map((s, i) => {
            const len = Math.min(s.frac, Math.max(0, p - s.start));
            return <circle key={i} r={200} fill="none" stroke={seriesColor(i, brand.primaryColor, brand.accentColor)} strokeWidth={90} pathLength={1} strokeDasharray={`${len} ${1 - len}`} strokeDashoffset={-s.start} />;
          })}
        </g>
        <text x={380} y={H / 2 + 14} textAnchor="middle" fontSize={56} fontWeight={800} fill={text} opacity={p}>{formatValue(data.reduce((a, x) => a + x.value, 0), unit)}</text>
        {data.map((x, i) => (
          <g key={i} opacity={interpolate(p, [segs[i]!.start, segs[i]!.start + 0.1], [0, 1], clamp)}>
            <rect x={760} y={80 + i * 70} width={30} height={30} rx={6} fill={seriesColor(i, brand.primaryColor, brand.accentColor)} />
            <text x={810} y={105 + i * 70} fontSize={36} fill={text}>{x.label}</text>
            <text x={W - R} y={105 + i * 70} textAnchor="end" fontSize={36} fontWeight={700} fill={text}>{Math.round((Math.abs(x.value) / total) * 100)}%</text>
          </g>
        ))}
      </svg>
    );
  }

  const slot = (W - L - R) / n;
  const grid = [0, 1, 2, 3, 4].map((k) => T + ((H - B - T) * k) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%" }}>
      {grid.map((y) => <line key={y} x1={L} x2={W - R} y1={y} y2={y} stroke={text} strokeOpacity={0.12} />)}
      <line x1={L} x2={W - R} y1={y0} y2={y0} stroke={text} strokeOpacity={0.5} strokeWidth={2} />
      {kind === "barChart"
        ? data.map((x, i) => {
            const pi = interpolate(p, [i / (n * 1.5), i / (n * 1.5) + 0.4], [0, 1], clamp);
            const yv = y0 + (scaleY(x.value, d, T, H - B) - y0) * pi;
            const bw = slot * 0.55;
            return (
              <g key={i}>
                <rect x={L + slot * i + (slot - bw) / 2} y={Math.min(y0, yv)} width={bw} height={Math.abs(yv - y0)} rx={8} fill={seriesColor(i, brand.primaryColor, brand.accentColor)} />
                <text x={L + slot * (i + 0.5)} y={Math.min(y0, yv) - 14} textAnchor="middle" fontSize={32} fontWeight={700} fill={text} opacity={pi}>{formatValue(x.value, unit)}</text>
                <text x={L + slot * (i + 0.5)} y={H - B + 48} textAnchor="middle" fontSize={30} fill={text}>{x.label}</text>
              </g>
            );
          })
        : (() => {
            const xs = data.map((_, i) => L + (n === 1 ? 0 : (i * (W - L - R)) / (n - 1)));
            const ys = data.map((x) => scaleY(x.value, d, T, H - B));
            const path = xs.map((x, i) => `${i ? "L" : "M"}${x},${ys[i]}`).join(" ");
            return (
              <g>
                <path d={path} fill="none" stroke={brand.accentColor} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${p} 1`} />
                {data.map((x, i) => {
                  const at = i / Math.max(1, n - 1);
                  const o = interpolate(p, [at - 0.05, at], [0, 1], clamp);
                  return (
                    <g key={i} opacity={o}>
                      <circle cx={xs[i]} cy={ys[i]} r={12} fill={brand.primaryColor} stroke={text} strokeWidth={3} />
                      <text x={xs[i]} y={ys[i]! - 24} textAnchor="middle" fontSize={30} fontWeight={700} fill={text}>{formatValue(x.value, unit)}</text>
                      <text x={xs[i]} y={H - B + 48} textAnchor="middle" fontSize={30} fill={text}>{x.label}</text>
                    </g>
                  );
                })}
              </g>
            );
          })()}
    </svg>
  );
};
