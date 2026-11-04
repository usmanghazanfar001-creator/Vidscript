import { z, ZodError } from "zod";
import {
  brandSchema, captionStyleSchema, sceneSchema, vidscriptPlanSchema,
  type Scene, type VidscriptPlan,
} from "@/remotion/schemas/vidscriptSchema";
import { defaultCaptionStyle } from "@/remotion/themes/defaultTheme";
import { countWords, estimateSeconds } from "@/lib/timing/duration";
import { normalizeScenes } from "@/lib/timing/normalize";
import type { ChatMessage, Completer } from "./groq";
import { TYPE_VISUALS } from "@/lib/storyboard/typeVisuals";
import { CLEARED_ASSET_FIELDS } from "@/lib/assets/types";

/** What Groq returns: only the creative storyboard. Everything else is assembled server-side. */
export const storyboardOutputSchema = z.object({
  title: z.string().min(1),
  scenes: z.array(sceneSchema).min(1),
});

export const visualPlanInputSchema = z
  .object({
    script: z.string().min(20, "Script is too short"),
    mode: z.enum(["silent-draft", "final-render"]).default("silent-draft"),
    wordsPerMinute: z.number().int().min(120).max(190).default(150),
    actualDurationSeconds: z.number().positive().nullable().default(null),
    visualStyle: z.string().min(1),
    audience: z.string().default("general YouTube audience"),
    tone: z.string().default("clear and engaging"),
    brand: brandSchema,
    captionStyle: captionStyleSchema.default(defaultCaptionStyle),
    targetSceneCount: z.number().int().min(3).max(40).nullable().default(null),
  })
  .refine((v) => v.mode === "silent-draft" || v.actualDurationSeconds != null, {
    message: "actualDurationSeconds is required in final-render mode",
    path: ["actualDurationSeconds"],
  });
export type VisualPlanInput = z.infer<typeof visualPlanInputSchema>;

export { TYPE_VISUALS };

export class VisualPlanError extends Error {
  constructor(message: string, public attempts: unknown[]) { super(message); }
}

export function targetDurationSeconds(input: VisualPlanInput): number {
  return input.mode === "final-render"
    ? input.actualDurationSeconds!
    : estimateSeconds(countWords(input.script), input.wordsPerMinute);
}

const SHAPE_GUIDE = [
  'Return ONE JSON object: {"title": string, "scenes": [Scene, ...]}.',
  'Scene: {"id","startSeconds","endSeconds","type","title","subtitle"|null,"scriptExcerpt"|null,"visual":Visual,',
  '"animation":"fade|slide-up|zoom-in|reveal|draw|none","transitionIn":"fade|slide|wipe|none","transitionOut":"fade|slide|wipe|none",',
  '"imagePrompt":string|null,"imageUrl":null,"notes":string|null,"assetQuery":string|null,"assetPreference":"photo|video|none"}',
  "Visual by kind:",
  '- bulletList, checklist: {"kind","items":[string]}',
  '- stepDiagram: {"kind","steps":[{"label","detail"|null}]}',
  '- statCallout: {"kind","value","label","context"|null}',
  '- quoteCard: {"kind","quote","attribution"|null}',
  '- imageWithCaption: {"kind","caption"}',
  '- callToAction: {"kind","text","url"|null}',
  '- lineChart, barChart, donutChart: {"kind","data":[{"label","value":number}],"unit"|null}',
  '- timeline: {"kind","events":[{"date","label"}]}',
  '- twoColumnComparison: {"kind","columns":[{"heading","points":[string]},{"heading","points":[string]}]}',
  "- animatedMap, worldMap, regionalMap, terrainMap, tradeRoutes, animatedBorders, beforeAfterMap, comparisonMap:",
  '  {"kind","regions":[{"name","highlight":boolean}],"labels":[{"text","x":0-1,"y":0-1}],"routes":[{"from","to","label"|null}],"borderChanges":[{"label","year"|null}]}',
].join("\n");

/** Room for the answer: about 300 tokens per scene plus thinking room for reasoning models. */
export const completionTokensFor = (sceneCount: number) => Math.min(12000, 3000 + 300 * sceneCount);

function buildMessages(input: VisualPlanInput, target: number, sceneCount: number): ChatMessage[] {
  const system = [
    "You are a visual storyboard planner for animated YouTube explainer videos.",
    "Return ONLY the JSON object described below. No markdown, no commentary.",
    "You plan visuals only. NEVER output voiceover, narration audio, caption text, caption timing, or render instructions.",
    "Scene rules:",
    `- Produce about ${sceneCount} scenes covering 0 to ${target.toFixed(1)} seconds, contiguous, no overlaps. Scene ids: s1, s2, ...`,
    "- Scenes should last roughly 8 to 15 seconds each. One main visual idea per scene. Keep on-screen text short (headline under 10 words, bullets under 8 words).",
    "- Each scene's visual.kind must be allowed for its type: " + JSON.stringify(TYPE_VISUALS),
    "- chart scenes need at least 2 data points; comparison scenes exactly 2 columns; process scenes 3-6 steps; bullets/summary 3-5 items.",
    "- Map visuals need at least one region, label, route, or borderChange. Label x/y are 0-1 fractions.",
    "- Only use real facts from the script. Never invent statistics for charts; if the script has no numbers, choose another scene type.",
    "- Set imagePrompt only when an image truly helps; otherwise null. imageUrl is always null.",
    '- Real photos and footage: for scenes of type title, hook, bullets, stat, quote, image, summary or timeline, set assetPreference to "photo" or "video" and assetQuery to 2-5 plain English words describing a real photograph or footage that illustrates the scene (a place, object, activity or era).',
    '  Use "video" for places, cities, nature and activity; "photo" for historical subjects and objects. Never put people\'s names, brands or logos in assetQuery.',
    '- For map, chart, process, comparison and cta scenes use assetPreference "none" and assetQuery null. Never output asset ids: they are filled in later.',
    "- Use scriptExcerpt to quote the part of the script the scene illustrates.",
    SHAPE_GUIDE,
  ].join("\n");
  const user = JSON.stringify({
    visualStyle: input.visualStyle, audience: input.audience, tone: input.tone,
    totalDurationSeconds: Number(target.toFixed(1)), targetSceneCount: sceneCount, script: input.script,
  });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

function describeError(e: unknown): string {
  if (e instanceof ZodError) return e.issues.slice(0, 10).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  return e instanceof Error ? e.message : String(e);
}

function parseJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(stripped); } catch { throw new Error("Response was not valid JSON"); }
}

export function assemblePlan(input: VisualPlanInput, target: number, text: string): VidscriptPlan {
  const out = storyboardOutputSchema.parse(parseJson(text));
  const mismatches = out.scenes
    .filter((s) => !TYPE_VISUALS[s.type].includes(s.visual.kind))
    .map((s) => `scene ${s.id}: type "${s.type}" cannot use visual kind "${s.visual.kind}" (allowed: ${TYPE_VISUALS[s.type].join(", ")})`);
  if (mismatches.length) throw new Error(mismatches.join("\n"));

  const final = input.mode === "final-render";
  return vidscriptPlanSchema.parse({
    version: "1.0", title: out.title, mode: input.mode, sourceScript: input.script,
    voiceoverUrl: null, captionsUrl: null,
    estimatedDurationSeconds: final ? null : target,
    actualDurationSeconds: final ? target : null,
    fps: 30, width: 1920, height: 1080,
    wordsPerMinute: input.wordsPerMinute, visualStyle: input.visualStyle,
    brand: input.brand, captionStyle: input.captionStyle,
    // The model only suggests search phrases; it can never claim an asset exists.
    scenes: normalizeScenes(out.scenes.map((s) => ({ ...s, ...CLEARED_ASSET_FIELDS })), target),
  });
}

/** Generates and validates a storyboard. Retries once with corrective feedback. */
export async function generateVisualPlan(rawInput: unknown, complete: Completer) {
  const input = visualPlanInputSchema.parse(rawInput);
  const target = targetDurationSeconds(input);
  const sceneCount = input.targetSceneCount ?? Math.min(40, Math.max(3, Math.round(target / 12)));
  let messages = buildMessages(input, target, sceneCount);
  const attempts: Array<{ response: string; error: string | null; structured: boolean }> = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await complete(messages, storyboardOutputSchema, { maxCompletionTokens: completionTokensFor(sceneCount) });
    try {
      const plan = assemblePlan(input, target, res.text);
      attempts.push({ response: res.text, error: null, structured: res.structured });
      return { plan, raw: { attempts } };
    } catch (e) {
      const error = describeError(e);
      attempts.push({ response: res.text, error, structured: res.structured });
      messages = [
        ...messages,
        { role: "assistant", content: res.text },
        { role: "user", content: `Your previous output failed validation:\n${error}\nReturn the corrected JSON object only.` },
      ];
    }
  }
  throw new VisualPlanError("The storyboard from Groq failed validation twice. Please retry.", attempts);
}
