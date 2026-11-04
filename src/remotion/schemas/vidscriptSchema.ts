import { z } from "zod";

const cssColor = z
  .string()
  .refine((v) => /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\(.+\)|[a-z]+)$/i.test(v.trim()), "Invalid CSS color");

const mapKinds = ["animatedMap", "worldMap", "regionalMap", "terrainMap", "tradeRoutes", "animatedBorders", "beforeAfterMap", "comparisonMap"] as const;
const mapVisual = z
  .object({
    kind: z.enum(mapKinds),
    regions: z.array(z.object({ name: z.string(), highlight: z.boolean().default(false) })).default([]),
    labels: z.array(z.object({ text: z.string(), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).default([]),
    routes: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().nullable().default(null) })).default([]),
    borderChanges: z.array(z.object({ label: z.string(), year: z.string().nullable().default(null) })).default([]),
  })
  .refine(
    (v) => v.regions.length + v.labels.length + v.routes.length + v.borderChanges.length > 0,
    "Map visuals need at least one region, label, route, or border change",
  );

const dataPoints = z.array(z.object({ label: z.string(), value: z.number() })).min(2, "Charts need at least two data points");

export const visualSchema = z.union([
  mapVisual,
  z.object({ kind: z.literal("timeline"), events: z.array(z.object({ date: z.string(), label: z.string() })).min(2) }),
  z.object({ kind: z.enum(["bulletList", "checklist"]), items: z.array(z.string()).min(1).max(5) }),
  z.object({ kind: z.literal("stepDiagram"), steps: z.array(z.object({ label: z.string(), detail: z.string().nullable().default(null) })).min(3).max(6) }),
  z.object({
    kind: z.literal("twoColumnComparison"),
    columns: z.tuple([
      z.object({ heading: z.string(), points: z.array(z.string()).min(1) }),
      z.object({ heading: z.string(), points: z.array(z.string()).min(1) }),
    ]),
  }),
  z.object({ kind: z.enum(["lineChart", "barChart", "donutChart"]), data: dataPoints, unit: z.string().nullable().default(null) }),
  z.object({ kind: z.literal("statCallout"), value: z.string(), label: z.string(), context: z.string().nullable().default(null) }),
  z.object({ kind: z.literal("quoteCard"), quote: z.string(), attribution: z.string().nullable().default(null) }),
  z.object({ kind: z.literal("imageWithCaption"), caption: z.string() }),
  z.object({ kind: z.literal("callToAction"), text: z.string(), url: z.string().nullable().default(null) }),
]);

export const sceneTypeSchema = z.enum(["title", "hook", "map", "timeline", "bullets", "process", "comparison", "chart", "quote", "image", "stat", "summary", "cta"]);
const anim = z.enum(["fade", "slide-up", "zoom-in", "reveal", "draw", "none"]);
const trans = z.enum(["fade", "slide", "wipe", "none"]);

export const sceneSchema = z.object({
  id: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().min(0),
  type: sceneTypeSchema,
  title: z.string(),
  subtitle: z.string().nullable().default(null),
  scriptExcerpt: z.string().nullable().default(null),
  visual: visualSchema,
  animation: anim.default("fade"),
  transitionIn: trans.default("fade"),
  transitionOut: trans.default("fade"),
  imagePrompt: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  // Stock visuals. assetQuery/assetPreference come from the storyboard; the asset* fields are filled in when a real
  // photo or clip is found, downloaded and cached (see src/lib/assets). They stay null when nothing was found.
  assetQuery: z.string().nullable().default(null),
  assetPreference: z.enum(["photo", "video", "none"]).default("none"),
  assetId: z.string().nullable().default(null),
  assetType: z.enum(["image", "video"]).nullable().default(null),
  assetProvider: z.string().nullable().default(null),
  assetCredit: z.string().nullable().default(null),
  assetLicense: z.string().nullable().default(null),
  assetSourceUrl: z.string().nullable().default(null),
  assetDurationSeconds: z.number().nullable().default(null),
});

/** Spread into a Scene literal to say "no stock asset yet". */
export const NO_ASSET = {
  assetQuery: null, assetPreference: "none", assetId: null, assetType: null, assetProvider: null,
  assetCredit: null, assetLicense: null, assetSourceUrl: null, assetDurationSeconds: null,
} as const;

export const brandSchema = z.object({
  primaryColor: cssColor,
  accentColor: cssColor,
  backgroundColor: cssColor,
  textColor: cssColor,
  fontFamily: z.string(),
  logoUrl: z.string().nullable().default(null),
  watermarkUrl: z.string().nullable().default(null),
});

export const captionStyleSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["bottom", "center-bottom", "top"]),
  fontSize: z.number().positive(),
  textColor: cssColor,
  backgroundColor: cssColor.nullable(),
  outlineColor: cssColor.nullable(),
  maxLines: z.literal(2),
});

export const OUTRO_ALLOWANCE_SECONDS = 3;
export const DURATION_TOLERANCE_SECONDS = 3;

export const vidscriptPlanSchema = z
  .object({
    version: z.literal("1.0"),
    title: z.string().min(1),
    mode: z.enum(["silent-draft", "final-render"]),
    sourceScript: z.string(),
    voiceoverUrl: z.string().nullable(),
    captionsUrl: z.string().nullable(),
    estimatedDurationSeconds: z.number().positive().nullable(),
    actualDurationSeconds: z.number().positive().nullable(),
    fps: z.literal(30),
    width: z.literal(1920),
    height: z.literal(1080),
    wordsPerMinute: z.number().int().min(120).max(190),
    visualStyle: z.string(),
    brand: brandSchema,
    captionStyle: captionStyleSchema,
    scenes: z.array(sceneSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });

    plan.scenes.forEach((s, i) => {
      if (s.endSeconds <= s.startSeconds) issue("Scene must end after it starts", ["scenes", i, "endSeconds"]);
      const prev = plan.scenes[i - 1];
      if (prev && s.startSeconds < prev.endSeconds - 1e-6) issue("Scenes must not overlap", ["scenes", i, "startSeconds"]);
    });

    const target = plan.mode === "silent-draft" ? plan.estimatedDurationSeconds : plan.actualDurationSeconds;
    if (target == null) {
      issue(plan.mode === "silent-draft" ? "estimatedDurationSeconds is required in silent-draft mode" : "actualDurationSeconds is required in final-render mode");
      return;
    }
    const total = plan.scenes[plan.scenes.length - 1]!.endSeconds;
    if (Math.abs(total - target) > DURATION_TOLERANCE_SECONDS) {
      issue(`Total scene duration (${total.toFixed(1)}s) must be within ±${DURATION_TOLERANCE_SECONDS}s of ${target.toFixed(1)}s`, ["scenes"]);
    }
    if (plan.mode === "silent-draft" && (plan.voiceoverUrl || plan.captionsUrl)) {
      issue("Silent drafts must not reference voiceover or captions", ["mode"]);
    }
  });

export type VidscriptPlan = z.infer<typeof vidscriptPlanSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Visual = z.infer<typeof visualSchema>;
