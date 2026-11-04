import { describe, expect, it } from "vitest";
import { buildCueChunks, checkBoundaries, scenesFromStarts, suggestRealignment, AlignmentError, realignOutputSchema } from "@/lib/ai/realign";
import { snapToCues, toFinalRenderPlan } from "@/lib/timing/finalPlan";
import { proportionalStretch } from "@/lib/timing/align";
import { computePeaks } from "@/lib/audio/peaks";
import { vidscriptPlanSchema, type Scene, type VidscriptPlan, NO_ASSET } from "@/remotion/schemas/vidscriptSchema";
import { defaultBrand, defaultCaptionStyle } from "@/remotion/themes/defaultTheme";
import type { Completer } from "@/lib/ai/groq";
import type { CaptionCue } from "@/lib/captions/parse";

const scene = (id: string, s: number, e: number): Scene => ({
  id, startSeconds: s, endSeconds: e, type: "bullets", title: id, subtitle: null, scriptExcerpt: `about ${id}`,
  visual: { kind: "bulletList", items: ["a"] }, animation: "fade", transitionIn: "fade", transitionOut: "fade", imagePrompt: null, imageUrl: null, notes: null, ...NO_ASSET,
});
const plan: VidscriptPlan = vidscriptPlanSchema.parse({
  version: "1.0", title: "T", mode: "silent-draft", sourceScript: "x", voiceoverUrl: null, captionsUrl: null,
  estimatedDurationSeconds: 60, actualDurationSeconds: null, fps: 30, width: 1920, height: 1080, wordsPerMinute: 150, visualStyle: "x",
  brand: defaultBrand, captionStyle: defaultCaptionStyle, scenes: [scene("s1", 0, 20), scene("s2", 20, 40), scene("s3", 40, 60)],
});
const cues: CaptionCue[] = Array.from({ length: 30 }, (_, i) => ({ startMs: i * 4000, endMs: i * 4000 + 3500, text: `line ${i}` }));
const fake = (responses: string[]): Completer => { let n = 0; return async () => ({ text: responses[Math.min(n++, responses.length - 1)]!, structured: false }); };
const good = JSON.stringify({ boundaries: [{ sceneId: "s1", startChunk: 0 }, { sceneId: "s2", startChunk: 10 }, { sceneId: "s3", startChunk: 20 }], rationale: "ok" });

describe("proportional stretch into a final-render plan", () => {
  it("produces a plan that passes validation", () => {
    const scenes = proportionalStretch(plan.scenes, 72);
    const final = toFinalRenderPlan(plan, { scenes, durationSeconds: 72, voiceoverUrl: "/v", captionsUrl: null });
    expect(vidscriptPlanSchema.safeParse(final).success).toBe(true);
    expect(final.mode).toBe("final-render");
    expect(final.estimatedDurationSeconds).toBe(60);
  });
  it("is rejected if the scenes do not match the voiceover", () => {
    const final = toFinalRenderPlan(plan, { scenes: plan.scenes, durationSeconds: 72, voiceoverUrl: "/v", captionsUrl: null });
    expect(vidscriptPlanSchema.safeParse(final).success).toBe(false);
  });
});

describe("snapToCues", () => {
  it("snaps within the window and leaves other times alone", () => {
    expect(snapToCues(10.2, [4, 10, 16])).toBe(10);
    expect(snapToCues(12, [4, 10, 16])).toBe(12);
  });
});

describe("computePeaks", () => {
  it("normalizes to 0..1 across buckets", () => {
    const ch = new Float32Array([0, 0.5, 0, -1, 0, 0.25, 0, 0]);
    const p = computePeaks([ch], 4);
    expect(Math.max(...p)).toBe(1);
    expect(p).toHaveLength(4);
  });
  it("returns nothing for empty audio", () => expect(computePeaks([new Float32Array(0)], 10)).toEqual([]));
});

describe("cue chunks and boundaries", () => {
  it("keeps every cue when under the cap and groups when over", () => {
    expect(buildCueChunks(cues, 400)).toHaveLength(30);
    const g = buildCueChunks(cues, 10);
    expect(g).toHaveLength(10);
    expect(g[1]!.startMs).toBe(cues[3]!.startMs);
  });
  it("builds a contiguous timeline ending at the total", () => {
    const out = scenesFromStarts(plan.scenes, [0, 40, 80], 120);
    expect(out.map((s) => [s.startSeconds, s.endSeconds])).toEqual([[0, 40], [40, 80], [80, 120]]);
  });
  it("keeps minimum scene length even for bad suggestions", () => {
    const out = scenesFromStarts(plan.scenes, [0, 0.1, 0.2], 60);
    for (const s of out) expect(s.endSeconds - s.startSeconds).toBeGreaterThanOrEqual(1.5);
    expect(out.at(-1)!.endSeconds).toBe(60);
  });
  it("rejects wrong ids, non-increasing and out-of-range chunks", () => {
    const bad = realignOutputSchema.parse({ boundaries: [{ sceneId: "s1", startChunk: 0 }, { sceneId: "zz", startChunk: 5 }, { sceneId: "s3", startChunk: 5 }], rationale: "" });
    const errors = checkBoundaries(bad, plan.scenes, 30);
    expect(errors.some((e) => /scene "s2"/.test(e))).toBe(true);
    expect(errors.some((e) => /strictly increase/.test(e))).toBe(true);
    expect(checkBoundaries(realignOutputSchema.parse({ boundaries: [{ sceneId: "s1", startChunk: 99 }] }), [plan.scenes[0]!], 30)[0]).toMatch(/out of range/);
  });
});

describe("suggestRealignment", () => {
  it("maps chunk choices to caption start times", async () => {
    const r = await suggestRealignment({ plan, cues, durationSeconds: 120 }, fake([good]));
    expect(r.scenes.map((s) => s.startSeconds)).toEqual([0, 40, 80]);
    expect(r.scenes.at(-1)!.endSeconds).toBe(120);
  });
  it("retries once after an invalid answer", async () => {
    const r = await suggestRealignment({ plan, cues, durationSeconds: 120 }, fake(["nonsense", good]));
    expect(r.attempts).toHaveLength(2);
  });
  it("fails after two invalid answers", async () => {
    await expect(suggestRealignment({ plan, cues, durationSeconds: 120 }, fake(["{}"]))).rejects.toBeInstanceOf(AlignmentError);
  });
  it("refuses when there are fewer caption segments than scenes", async () => {
    await expect(suggestRealignment({ plan, cues: cues.slice(0, 2), durationSeconds: 120 }, fake([good]))).rejects.toBeInstanceOf(AlignmentError);
  });
});
