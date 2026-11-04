import { describe, expect, it } from "vitest";
import { mergeWithNext, splitScene } from "@/lib/timing/edit";
import { defaultVisual, TYPE_VISUALS } from "@/lib/storyboard/typeVisuals";
import { visualSchema, type Scene, NO_ASSET } from "@/remotion/schemas/vidscriptSchema";

const scene = (id: string, s: number, e: number): Scene => ({
  id, startSeconds: s, endSeconds: e, type: "bullets", title: id, subtitle: null, scriptExcerpt: null,
  visual: { kind: "bulletList", items: ["a"] }, animation: "fade", transitionIn: "fade", transitionOut: "fade", imagePrompt: null, imageUrl: null, notes: null, ...NO_ASSET,
});

describe("scene editing", () => {
  it("splits at the midpoint and stays contiguous", () => {
    const out = splitScene([scene("a", 0, 10), scene("b", 10, 20)], 0, undefined, () => "new");
    expect(out.map((s) => [s.id, s.startSeconds, s.endSeconds])).toEqual([["a", 0, 5], ["new", 5, 10], ["b", 10, 20]]);
  });
  it("refuses splits that make tiny scenes", () => {
    expect(() => splitScene([scene("a", 0, 2)], 0)).toThrow(/at least/);
  });
  it("merges with the next scene", () => {
    const out = mergeWithNext([scene("a", 0, 10), scene("b", 10, 20)], 0);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "a", startSeconds: 0, endSeconds: 20 });
  });
  it("cannot merge the last scene", () => {
    expect(() => mergeWithNext([scene("a", 0, 10)], 0)).toThrow();
  });
});

describe("default visuals", () => {
  it("are valid for every kind allowed by any scene type", () => {
    const kinds = new Set(Object.values(TYPE_VISUALS).flat());
    for (const k of kinds) {
      const r = visualSchema.safeParse(defaultVisual(k));
      expect(r.success, `${k}: ${r.success ? "" : r.error.message}`).toBe(true);
      expect(defaultVisual(k).kind).toBe(k);
    }
  });
});
