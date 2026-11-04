export type Domain = { min: number; max: number };

/** Value domain that always includes zero so bars share a baseline. */
export function domain(values: number[]): Domain {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  return { min, max: max === min ? min + 1 : max };
}

export function scaleY(v: number, d: Domain, top: number, bottom: number): number {
  return bottom - ((v - d.min) / (d.max - d.min)) * (bottom - top);
}

/** Donut segments as fractions of the circle (uses absolute values; a donut needs positive shares). */
export function donutSegments(values: number[]): Array<{ start: number; frac: number }> {
  const abs = values.map((v) => Math.abs(v));
  const total = abs.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return abs.map((v) => {
    const seg = { start: acc, frac: v / total };
    acc += seg.frac;
    return seg;
  });
}

export function formatValue(v: number, unit: string | null): string {
  const n = Math.round(v * 100) / 100;
  const text = Math.abs(n) >= 1000 ? n.toLocaleString("en-US") : String(n);
  return unit ? `${text} ${unit}` : text;
}

export const seriesColor = (i: number, primary: string, accent: string) => [primary, accent, "#7FD1AE", "#E2C044", "#C792EA", "#FF6B6B"][i % 6]!;
