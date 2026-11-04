import { describe, expect, it } from "vitest";
import { parseRange, slugify } from "@/lib/render/range";
import { RENDER_FILES, renderFilePath } from "@/lib/storage/local";
import { sceneTimingExport } from "@/lib/render/metadata";
import { vidscriptPlanSchema } from "@/remotion/schemas/vidscriptSchema";
import { defaultBrand, defaultCaptionStyle } from "@/remotion/themes/defaultTheme";

describe("parseRange", () => {
  it("returns null without a header", () => expect(parseRange(null, 1000)).toBeNull());
  it("parses open-ended ranges", () => expect(parseRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 }));
  it("parses closed ranges and clamps the end", () => expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 }));
  it("parses suffix ranges", () => expect(parseRange("bytes=-200", 1000)).toEqual({ start: 800, end: 999 }));
  it("rejects ranges past the end", () => expect(parseRange("bytes=2000-", 1000)).toBe("unsatisfiable"));
  it("ignores malformed headers", () => expect(parseRange("pages=1-2", 1000)).toBeNull());
});

describe("render files", () => {
  it("whitelists exactly four files", () => expect([...RENDER_FILES]).toEqual(["draft.mp4", "sceneTiming.json", "storyboard.json", "credits.txt"]));
  it("keeps paths inside the render directory", () => expect(renderFilePath("job1", "draft.mp4")).toContain("job1"));
  it("slugifies titles for download names", () => {
    expect(slugify("The Silk Road: A History!")).toBe("the-silk-road-a-history");
    expect(slugify("???")).toBe("vidscript");
  });
});

describe("sceneTiming export", () => {
  it("labels the output as a silent draft and lists scene times", () => {
    const plan = vidscriptPlanSchema.parse({
      version: "1.0", title: "T", mode: "silent-draft", sourceScript: "x", voiceoverUrl: null, captionsUrl: null,
      estimatedDurationSeconds: 10, actualDurationSeconds: null, fps: 30, width: 1920, height: 1080, wordsPerMinute: 150, visualStyle: "x",
      brand: defaultBrand, captionStyle: defaultCaptionStyle,
      scenes: [{ id: "a", startSeconds: 0, endSeconds: 10, type: "stat", title: "A", visual: { kind: "statCallout", value: "1", label: "x" } }],
    });
    const out = sceneTimingExport(plan);
    expect(out.label).toMatch(/SILENT DRAFT/);
    expect(out.scenes).toEqual([{ id: "a", type: "stat", title: "A", startSeconds: 0, endSeconds: 10 }]);
  });
});
