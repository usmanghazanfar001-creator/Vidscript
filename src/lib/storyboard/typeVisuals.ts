import type { Scene, Visual } from "@/remotion/schemas/vidscriptSchema";

export const MAP_KINDS = ["animatedMap", "worldMap", "regionalMap", "terrainMap", "tradeRoutes", "animatedBorders", "beforeAfterMap", "comparisonMap"];

/** Which visual kinds each scene type's template can render. */
export const TYPE_VISUALS: Record<Scene["type"], string[]> = {
  title: ["callToAction", "statCallout", "imageWithCaption"],
  hook: ["statCallout", "quoteCard"],
  map: MAP_KINDS,
  timeline: ["timeline"],
  bullets: ["bulletList", "checklist"],
  process: ["stepDiagram"],
  comparison: ["twoColumnComparison"],
  chart: ["lineChart", "barChart", "donutChart"],
  quote: ["quoteCard"],
  image: ["imageWithCaption"],
  stat: ["statCallout"],
  summary: ["bulletList", "checklist"],
  cta: ["callToAction"],
};

/** A valid starter visual for any kind, used when the user switches scene type or visual. */
export function defaultVisual(kind: string): Visual {
  if (MAP_KINDS.includes(kind)) return { kind, regions: [{ name: "Region", highlight: true }], labels: [], routes: [], borderChanges: [] } as Visual;
  switch (kind) {
    case "timeline": return { kind, events: [{ date: "Year", label: "First event" }, { date: "Year", label: "Second event" }] };
    case "bulletList": case "checklist": return { kind, items: ["Point one", "Point two", "Point three"] };
    case "stepDiagram": return { kind, steps: [1, 2, 3].map((n) => ({ label: `Step ${n}`, detail: null })) };
    case "twoColumnComparison": return { kind, columns: [{ heading: "A", points: ["Point"] }, { heading: "B", points: ["Point"] }] };
    case "lineChart": case "barChart": case "donutChart": return { kind, data: [{ label: "A", value: 1 }, { label: "B", value: 2 }], unit: null } as Visual;
    case "statCallout": return { kind, value: "100", label: "Label", context: null };
    case "quoteCard": return { kind, quote: "Quote", attribution: null };
    case "imageWithCaption": return { kind, caption: "Caption" };
    default: return { kind: "callToAction", text: "Subscribe", url: null };
  }
}
