import { z, ZodError } from "zod";
import type { CaptionCue } from "@/lib/captions/parse";
import type { Scene, VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import { MIN_SCENE_SECONDS } from "@/lib/timing/edit";
import { round3 } from "@/lib/timing/duration";
import type { ChatMessage, Completer } from "./groq";

export type Chunk = { index: number; startMs: number; text: string };

/** Groups cues into at most `maxChunks` chunks so long videos still fit in a prompt. Text is only ever sent, never changed. */
export function buildCueChunks(cues: CaptionCue[], maxChunks = 400): Chunk[] {
  const size = Math.max(1, Math.ceil(cues.length / maxChunks));
  const chunks: Chunk[] = [];
  for (let i = 0; i < cues.length; i += size) {
    const group = cues.slice(i, i + size);
    chunks.push({ index: chunks.length, startMs: group[0]!.startMs, text: group.map((c) => c.text.replace(/\s+/g, " ")).join(" ").slice(0, 140) });
  }
  return chunks;
}

/**
 * Turns suggested scene start times into a contiguous timeline ending exactly at `total`.
 * Every scene keeps at least `min` seconds; scene 1 always starts at 0.
 */
export function scenesFromStarts(scenes: Scene[], starts: number[], total: number, min = MIN_SCENE_SECONDS): Scene[] {
  const n = scenes.length;
  if (total < n * min) throw new RangeError(`The voiceover is too short for ${n} scenes of at least ${min}s`);
  const s: number[] = [0];
  for (let i = 1; i < n; i++) s.push(Math.min(Math.max(starts[i]!, s[i - 1]! + min), total - min * (n - i)));
  return scenes.map((sc, i) => ({ ...sc, startSeconds: round3(s[i]!), endSeconds: round3(i === n - 1 ? total : s[i + 1]!) }));
}

export const realignOutputSchema = z.object({
  boundaries: z.array(z.object({ sceneId: z.string(), startChunk: z.number().int().min(0) })).min(1),
  rationale: z.string().default(""),
});

export function checkBoundaries(out: z.infer<typeof realignOutputSchema>, scenes: Scene[], chunkCount: number): string[] {
  const errors: string[] = [];
  if (out.boundaries.length !== scenes.length) errors.push(`Expected ${scenes.length} boundaries (one per scene, in order), got ${out.boundaries.length}`);
  scenes.forEach((s, i) => { if (out.boundaries[i] && out.boundaries[i]!.sceneId !== s.id) errors.push(`Boundary ${i + 1} must be for scene "${s.id}"`); });
  out.boundaries.forEach((b, i) => {
    if (b.startChunk >= chunkCount) errors.push(`startChunk ${b.startChunk} is out of range (0 to ${chunkCount - 1})`);
    if (i >= 1 && b.startChunk <= (out.boundaries[i - 1]!.startChunk)) errors.push(`startChunk values must strictly increase (scene ${i + 1})`);
  });
  return errors;
}

export class AlignmentError extends Error {
  constructor(message: string, public attempts: unknown[] = []) { super(message); }
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function buildMessages(plan: VidscriptPlan, chunks: Chunk[], durationSeconds: number): ChatMessage[] {
  const planEnd = plan.scenes[plan.scenes.length - 1]!.endSeconds;
  const system = [
    "You align animated-video scenes to a finished voiceover.",
    "You are given the scenes (in order) and the voiceover's caption chunks with start times.",
    "For each scene, choose the caption chunk where that scene's visual should START: where the narration begins covering that scene's topic.",
    "Rules: scene 1 always uses chunk 0. startChunk must strictly increase from scene to scene. Prefer natural topic changes. Use scriptExcerpt and expectedPosition as hints.",
    "Return ONLY JSON: {\"boundaries\":[{\"sceneId\":\"...\",\"startChunk\":0}, ...],\"rationale\":\"one or two sentences\"}.",
    "Output one boundary per scene, in the same order. Never output caption text or timestamps.",
  ].join("\n");
  const user = JSON.stringify({
    voiceoverSeconds: Number(durationSeconds.toFixed(1)),
    scenes: plan.scenes.map((s) => ({ id: s.id, type: s.type, title: s.title, scriptExcerpt: s.scriptExcerpt?.slice(0, 300) ?? null, expectedPosition: Number((s.startSeconds / planEnd).toFixed(3)) })),
    chunks: chunks.map((c) => `${c.index}|${mmss(c.startMs)}|${c.text}`),
  });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

function describe(e: unknown): string {
  if (e instanceof ZodError) return e.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
  return e instanceof Error ? e.message : String(e);
}

/** AI-assisted realignment. Returns a SUGGESTION only; the user must approve it before it changes anything. */
export async function suggestRealignment(
  input: { plan: VidscriptPlan; cues: CaptionCue[]; durationSeconds: number },
  complete: Completer,
) {
  const { plan, cues, durationSeconds } = input;
  const chunks = buildCueChunks(cues);
  if (chunks.length < plan.scenes.length) throw new AlignmentError(`There are only ${chunks.length} caption segments for ${plan.scenes.length} scenes, which is not enough to align them.`);

  let messages = buildMessages(plan, chunks, durationSeconds);
  const attempts: unknown[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await complete(messages, realignOutputSchema);
    try {
      const raw = res.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const out = realignOutputSchema.parse(JSON.parse(raw));
      const problems = checkBoundaries(out, plan.scenes, chunks.length);
      if (problems.length) throw new Error(problems.join("\n"));
      const starts = out.boundaries.map((b, i) => (i === 0 ? 0 : chunks[b.startChunk]!.startMs / 1000));
      const scenes = scenesFromStarts(plan.scenes, starts, durationSeconds);
      attempts.push({ response: res.text, error: null });
      return { scenes, rationale: out.rationale, attempts };
    } catch (e) {
      const error = e instanceof SyntaxError ? "Response was not valid JSON" : describe(e);
      attempts.push({ response: res.text, error });
      messages = [...messages, { role: "assistant", content: res.text }, { role: "user", content: `Your previous output failed validation:\n${error}\nReturn the corrected JSON only.` }];
    }
  }
  throw new AlignmentError("Groq's suggested timeline failed validation twice. Please retry.", attempts);
}
