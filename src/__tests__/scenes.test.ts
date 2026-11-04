import { describe, expect, it } from "vitest";
import { domain, donutSegments, formatValue, scaleY } from "@/remotion/elements/chartMath";
import { blobPath, controlPoint, layoutNames, quadPoint, resolvePoints, terrainOf, MAP_H, MAP_W, type MapVisual } from "@/remotion/elements/mapGeometry";

describe("chart math", () => {
  it("domain always includes zero", () => expect(domain([3, 8])).toEqual({ min: 0, max: 8 }));
  it("handles all-zero data", () => expect(domain([0, 0]).max).toBeGreaterThan(0));
  it("maps values to the baseline and top", () => {
    const d = domain([0, 10]);
    expect(scaleY(0, d, 50, 450)).toBe(450);
    expect(scaleY(10, d, 50, 450)).toBe(50);
  });
  it("donut fractions sum to 1", () => {
    const segs = donutSegments([1, 1, 2]);
    expect(segs.reduce((a, s) => a + s.frac, 0)).toBeCloseTo(1);
    expect(segs[2]!.start).toBeCloseTo(0.5);
  });
  it("formats values with units", () => expect(formatValue(1234.5, "km")).toBe("1,234.5 km"));
});

describe("map geometry", () => {
  const v: MapVisual = {
    kind: "tradeRoutes", regions: [{ name: "Rome", highlight: true }, { name: "Alexandria", highlight: false }],
    labels: [{ text: "Port", x: 0.5, y: 0.25 }], routes: [{ from: "Rome", to: "Carthage", label: null }], borderChanges: [],
  };
  it("is deterministic", () => expect(layoutNames(["a", "b", "c"])).toEqual(layoutNames(["a", "b", "c"])));
  it("keeps points on the canvas", () => {
    for (const p of Object.values(layoutNames(Array.from({ length: 12 }, (_, i) => `r${i}`)))) {
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(MAP_W);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(MAP_H);
    }
  });
  it("places unknown route endpoints and uses label coordinates", () => {
    const pts = resolvePoints(v);
    expect(pts["Carthage"]).toBeDefined();
    expect(pts["Port"]).toEqual({ x: 800, y: 225 });
  });
  it("builds a closed path", () => expect(blobPath({ x: 100, y: 100 }, 50, "x").endsWith("Z")).toBe(true));
  it("quad curve hits its endpoints", () => {
    const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
    const c = controlPoint(a, b);
    expect(quadPoint(a, c, b, 0)).toEqual(a);
    expect(quadPoint(a, c, b, 1)).toEqual(b);
  });
  it("detects terrain keywords", () => {
    expect(terrainOf("Himalaya Range")).toBe("mountain");
    expect(terrainOf("Nile Delta")).toBe("river");
    expect(terrainOf("Rome")).toBeNull();
  });
});

import { hasBackdrop, assetSrc } from "@/remotion/elements/assetUrl";
import { creditsText } from "@/lib/render/metadata";
import { vidscriptPlanSchema, NO_ASSET } from "@/remotion/schemas/vidscriptSchema";
import { defaultBrand, defaultCaptionStyle } from "@/remotion/themes/defaultTheme";

describe("backdrops and credits", () => {
  it("shows a backdrop only for scene types that read well over a photo, and only when an asset exists", () => {
    expect(hasBackdrop({ type: "bullets", assetId: "a", assetType: "image" })).toBe(true);
    expect(hasBackdrop({ type: "title", assetId: "a", assetType: "video" })).toBe(true);
    expect(hasBackdrop({ type: "chart", assetId: "a", assetType: "image" })).toBe(false);
    expect(hasBackdrop({ type: "map", assetId: "a", assetType: "image" })).toBe(false);
    expect(hasBackdrop({ type: "bullets", assetId: null, assetType: null })).toBe(false);
  });
  it("builds asset URLs from the base address", () => {
    expect(assetSrc("", "x1")).toBe("/api/assets/x1/file");
    expect(assetSrc("http://localhost:3000", "x1")).toBe("http://localhost:3000/api/assets/x1/file");
  });
  const plan = (withAsset: boolean) => vidscriptPlanSchema.parse({
    version: "1.0", title: "Iceland", mode: "silent-draft", sourceScript: "x", voiceoverUrl: null, captionsUrl: null, estimatedDurationSeconds: 20, actualDurationSeconds: null,
    fps: 30, width: 1920, height: 1080, wordsPerMinute: 150, visualStyle: "x", brand: defaultBrand, captionStyle: defaultCaptionStyle,
    scenes: [
      { ...NO_ASSET, id: "a", startSeconds: 0, endSeconds: 10, type: "stat", title: "Hero", visual: { kind: "statCallout", value: "1", label: "x" } },
      { ...NO_ASSET, id: "b", startSeconds: 10, endSeconds: 20, type: "stat", title: "Bay", visual: { kind: "statCallout", value: "2", label: "y" },
        ...(withAsset ? { assetId: "m1", assetType: "image", assetProvider: "commons", assetCredit: "Jane / Wikimedia Commons / CC BY 4.0", assetLicense: "CC BY 4.0", assetSourceUrl: "https://commons.wikimedia.org/wiki/File:x.jpg" } : {}) },
    ],
  });
  it("credits list the source, licence and page for each stock asset, by scene", () => {
    const text = creditsText(plan(true));
    expect(text).toMatch(/Scene 2: Bay \(0:10-0:20\)/);
    expect(text).toMatch(/Jane \/ Wikimedia Commons \/ CC BY 4.0/);
    expect(text).toMatch(/Licence: CC BY 4.0/);
    expect(text).not.toMatch(/Scene 1/);
  });
  it("credits say so when no stock media was used", () => expect(creditsText(plan(false))).toMatch(/No stock media was used/));
});
