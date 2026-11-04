import { describe, expect, it } from "vitest";
import { generateVisualPlan, VisualPlanError } from "@/lib/ai/visualPlan";
import { normalizeScenes } from "@/lib/timing/normalize";
import { defaultBrand } from "@/remotion/themes/defaultTheme";
import type { Completer } from "@/lib/ai/groq";

const script = Array(300).fill("word").join(" "); // 300 words @150 WPM = 120s
const input = { script, visualStyle: "educational slides", brand: defaultBrand };

const bulletScene = (id: string, s: number, e: number) => ({
  id, startSeconds: s, endSeconds: e, type: "bullets", title: id, subtitle: null, scriptExcerpt: null,
  visual: { kind: "bulletList", items: ["a", "b", "c"] }, animation: "fade", transitionIn: "fade", transitionOut: "fade",
  imagePrompt: null, imageUrl: null, notes: null,
});
const good = JSON.stringify({ title: "T", scenes: [bulletScene("s1", 0, 10), bulletScene("s2", 10, 40)] });

const completerFrom = (responses: string[]): Completer & { calls: number } => {
  const fn = (async () => ({ text: responses[Math.min(fn.calls++, responses.length - 1)]!, structured: false })) as unknown as Completer & { calls: number };
  fn.calls = 0;
  return fn;
};

describe("generateVisualPlan", () => {
  it("builds a valid plan and snaps timings to the estimated duration", async () => {
    const { plan } = await generateVisualPlan(input, completerFrom([good]));
    expect(plan.estimatedDurationSeconds).toBe(120);
    expect(plan.scenes.at(-1)!.endSeconds).toBe(120);
    expect(plan.scenes[0]!.endSeconds).toBe(plan.scenes[1]!.startSeconds);
  });

  it("retries once with feedback after invalid output", async () => {
    const c = completerFrom(["not json", good]);
    const { raw } = await generateVisualPlan(input, c);
    expect(c.calls).toBe(2);
    expect(raw.attempts[0]!.error).toMatch(/JSON/);
  });

  it("fails after two invalid attempts", async () => {
    await expect(generateVisualPlan(input, completerFrom(["{}"]))).rejects.toBeInstanceOf(VisualPlanError);
  });

  it("rejects scene types paired with unsupported visuals", async () => {
    const bad = JSON.stringify({ title: "T", scenes: [{ ...bulletScene("s1", 0, 30), type: "chart" }] });
    await expect(generateVisualPlan(input, completerFrom([bad]))).rejects.toBeInstanceOf(VisualPlanError);
  });

  it("requires actual duration in final-render mode", async () => {
    await expect(generateVisualPlan({ ...input, mode: "final-render" }, completerFrom([good]))).rejects.toThrow();
  });
});

describe("normalizeScenes", () => {
  it("makes scenes contiguous and exactly target long", () => {
    const out = normalizeScenes([bulletScene("a", 5, 10), bulletScene("b", 0, 5)] as never, 60);
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
    expect(out[0]!.startSeconds).toBe(0);
    expect(out[1]!.endSeconds).toBe(60);
  });
});

describe("request size", () => {
  it("keeps the system prompt compact and caps the answer length", async () => {
    let system = 0, cap: number | undefined;
    const spy: Completer = async (messages, _schema, opts) => { system = messages[0]!.content.length; cap = opts?.maxCompletionTokens; return { text: good, structured: true }; };
    await generateVisualPlan(input, spy);
    expect(system).toBeLessThan(5000);
    expect(cap).toBeGreaterThan(3000);
    expect(cap).toBeLessThan(12001);
  });
  it("asks for scenes of roughly 10 to 15 seconds by default", async () => {
    let user = "";
    const spy: Completer = async (messages) => { user = messages[1]!.content; return { text: good, structured: true }; };
    await generateVisualPlan(input, spy); // 120s script
    expect(JSON.parse(user).targetSceneCount).toBe(10);
  });
});


describe("stock visuals in the storyboard", () => {
  it("keeps search phrases but wipes any asset the model claims to have found", async () => {
    const invented = JSON.stringify({ title: "T", scenes: [{ ...bulletScene("s1", 0, 30), assetQuery: "tokyo skyline night", assetPreference: "video", assetId: "fake123", assetType: "video", assetProvider: "pexels", assetCredit: "made up" }] });
    const { plan } = await generateVisualPlan(input, completerFrom([invented]));
    const s = plan.scenes[0]!;
    expect(s.assetQuery).toBe("tokyo skyline night");
    expect(s.assetPreference).toBe("video");
    expect(s.assetId).toBeNull();
    expect(s.assetCredit).toBeNull();
    expect(s.assetType).toBeNull();
  });
  it("asks the model for search phrases and tells it not to output asset ids", async () => {
    let system = "";
    const spy: Completer = async (messages) => { system = messages[0]!.content; return { text: good, structured: true }; };
    await generateVisualPlan(input, spy);
    expect(system).toMatch(/assetQuery/);
    expect(system).toMatch(/Never output asset ids/);
  });
});
