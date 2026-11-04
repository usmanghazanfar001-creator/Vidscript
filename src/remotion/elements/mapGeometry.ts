import type { Visual } from "../schemas/vidscriptSchema";

export const MAP_W = 1600;
export const MAP_H = 900;
export type Pt = { x: number; y: number };
export type MapVisual = Extract<Visual, { regions: unknown }>;

/** Stable 0..1 hash so the same name always lands in the same place. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Spreads names over the canvas with a golden-angle spiral: deterministic and non-overlapping. */
export function layoutNames(names: string[]): Record<string, Pt> {
  const out: Record<string, Pt> = {};
  const n = names.length;
  names.forEach((name, i) => {
    if (n === 1) return void (out[name] = { x: MAP_W / 2, y: MAP_H / 2 });
    const angle = i * 2.39996;
    const r = Math.sqrt((i + 0.5) / n);
    out[name] = { x: MAP_W / 2 + r * MAP_W * 0.34 * Math.cos(angle), y: MAP_H / 2 + r * MAP_H * 0.34 * Math.sin(angle) };
  });
  return out;
}

/** Positions for every named thing on the map: regions, explicit labels, and unknown route endpoints. */
export function resolvePoints(v: MapVisual): Record<string, Pt> {
  const names = v.regions.map((r) => r.name);
  v.routes.forEach((r) => [r.from, r.to].forEach((n) => { if (!names.includes(n) && !v.labels.some((l) => l.text === n)) names.push(n); }));
  const pts = layoutNames(names);
  v.labels.forEach((l) => { pts[l.text] = { x: l.x * MAP_W, y: l.y * MAP_H }; });
  return pts;
}

export function blobPath(c: Pt, r: number, seed: string): string {
  const n = 9;
  const pts: Pt[] = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (0.78 + 0.42 * hash(`${seed}${k}`));
    return { x: c.x + Math.cos(a) * rr * 1.25, y: c.y + Math.sin(a) * rr };
  });
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const start = mid(pts[n - 1]!, pts[0]!);
  let d = `M${start.x.toFixed(1)},${start.y.toFixed(1)}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % n]!);
    d += ` Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${m.x.toFixed(1)},${m.y.toFixed(1)}`;
  });
  return d + "Z";
}

export function controlPoint(a: Pt, b: Pt, bend = 0.22): Pt {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return { x: mx - (b.y - a.y) * bend, y: my + (b.x - a.x) * bend };
}

export function quadPoint(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

export type Terrain = "mountain" | "river" | "desert" | "water" | null;
export function terrainOf(name: string): Terrain {
  const n = name.toLowerCase();
  if (/mountain|range|alps|himalaya|andes|plateau|pass\b|peak|hill/.test(n)) return "mountain";
  if (/river|nile|delta|valley|canal|stream/.test(n)) return "river";
  if (/desert|sahara|steppe|dune|arid/.test(n)) return "desert";
  if (/sea|ocean|coast|gulf|bay|strait|lake|port/.test(n)) return "water";
  return null;
}
