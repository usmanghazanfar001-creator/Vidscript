import { describe, expect, it } from "vitest";
import { countWords, estimateSeconds, toFrames, proportionalBoundaries } from "@/lib/timing/duration";
import { proportionalStretch, moveBoundary } from "@/lib/timing/align";
import { parseCaptions, validateCues } from "@/lib/captions/parse";
import { computeDurationInFrames } from "@/lib/render/metadata";
import { vidscriptPlanSchema, type Scene, NO_ASSET } from "@/remotion/schemas/vidscriptSchema";
import { defaultBrand, defaultCaptionStyle } from "@/remotion/themes/defaultTheme";

const scene = (id: string, s: number, e: number): Scene => ({
  id, startSeconds: s, endSeconds: e, type: "bullets", title: id, subtitle: null, scriptExcerpt: null,
  visual: { kind: "bulletList", items: ["a"] }, animation: "fade", transitionIn: "fade", transitionOut: "fade", imagePrompt: null, imageUrl: null, notes: null, ...NO_ASSET,
});
const plan = (scenes: Scene[], over = {}) => ({
  version: "1.0", title: "t", mode: "silent-draft", sourceScript: "x", voiceoverUrl: null, captionsUrl: null,
  estimatedDurationSeconds: 60, actualDurationSeconds: null, fps: 30, width: 1920, height: 1080, wordsPerMinute: 150,
  visualStyle: "x", brand: defaultBrand, captionStyle: defaultCaptionStyle, scenes, ...over,
});

describe("duration", () => {
  it("counts words and ignores markdown", () => expect(countWords("# Title\n\nHello **big** world")).toBe(4));
  it("estimates seconds", () => expect(estimateSeconds(300, 150)).toBe(120));
  it("rejects out-of-range pace", () => expect(() => estimateSeconds(100, 100)).toThrow());
  it("ceil frames", () => expect(toFrames(489, 30)).toBe(14670));
  it("splits proportionally", () => expect(proportionalBoundaries(60, [1, 1, 2]).at(-1)?.end).toBe(60));
});

describe("alignment", () => {
  it("stretches 8%", () => {
    const out = proportionalStretch([scene("a", 0, 50), scene("b", 50, 100)], 108);
    expect(out[0]!.endSeconds).toBe(54);
    expect(out[1]!.endSeconds).toBe(108);
  });
  it("prevents boundary overlap", () => {
    const out = moveBoundary([scene("a", 0, 10), scene("b", 10, 20)], 0, 50);
    expect(out[0]!.endSeconds).toBeLessThan(out[1]!.endSeconds);
    expect(out[0]!.endSeconds).toBe(out[1]!.startSeconds);
  });
});

describe("captions", () => {
  const srt = "1\n00:00:00,000 --> 00:00:02,500\nHello\nworld\n\n2\n00:00:02,500 --> 00:00:05,000\nBye\n";
  it("parses SRT verbatim", () => expect(parseCaptions(srt, "srt")[0]).toEqual({ startMs: 0, endMs: 2500, text: "Hello\nworld" }));
  it("parses VTT", () => expect(parseCaptions("WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n", "vtt")[0]?.startMs).toBe(1000));
  it("flags cues beyond voiceover", () => expect(validateCues(parseCaptions(srt, "srt"), 3).valid).toBe(false));
});

describe("plan validation", () => {
  it("accepts a valid plan", () => expect(vidscriptPlanSchema.safeParse(plan([scene("a", 0, 30), scene("b", 30, 60)])).success).toBe(true));
  it("rejects overlap", () => expect(vidscriptPlanSchema.safeParse(plan([scene("a", 0, 40), scene("b", 30, 60)])).success).toBe(false));
  it("rejects duration mismatch beyond 3s", () => expect(vidscriptPlanSchema.safeParse(plan([scene("a", 0, 50)])).success).toBe(false));
  it("rejects charts with <2 points", () => {
    const bad = { ...scene("a", 0, 60), type: "chart", visual: { kind: "barChart", data: [{ label: "x", value: 1 }] } } as unknown as Scene;
    expect(vidscriptPlanSchema.safeParse(plan([bad])).success).toBe(false);
  });
});

describe("render metadata", () => {
  it("silent draft uses estimate", () => expect(computeDurationInFrames({ mode: "silent-draft", estimatedDurationSeconds: 60, actualDurationSeconds: null, scenes: [scene("a", 0, 60)] })).toBe(1800));
  it("final uses voiceover, allows outro", () =>
    expect(computeDurationInFrames({ mode: "final-render", estimatedDurationSeconds: 60, actualDurationSeconds: 489, scenes: [scene("a", 0, 491)] })).toBe(Math.ceil(491 * 30)));
});
