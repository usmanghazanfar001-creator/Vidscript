import type { Scene } from "@/remotion/schemas/vidscriptSchema";
import { round3 } from "./duration";

export const MIN_SCENE_SECONDS = 1.5;
const newId = () => `s${Math.random().toString(36).slice(2, 8)}`;

export function splitScene(scenes: Scene[], index: number, atSeconds?: number, makeId: () => string = newId): Scene[] {
  const s = scenes[index];
  if (!s) throw new RangeError("No such scene");
  const at = atSeconds ?? (s.startSeconds + s.endSeconds) / 2;
  if (at - s.startSeconds < MIN_SCENE_SECONDS || s.endSeconds - at < MIN_SCENE_SECONDS) {
    throw new RangeError(`Both halves must be at least ${MIN_SCENE_SECONDS}s long`);
  }
  const first: Scene = { ...s, endSeconds: round3(at) };
  const second: Scene = { ...s, id: makeId(), startSeconds: round3(at), title: `${s.title} (cont.)` };
  return [...scenes.slice(0, index), first, second, ...scenes.slice(index + 1)];
}

/** Merges scene[index] with the next one, keeping the first scene's content. */
export function mergeWithNext(scenes: Scene[], index: number): Scene[] {
  const a = scenes[index];
  const b = scenes[index + 1];
  if (!a || !b) throw new RangeError("There is no next scene to merge with");
  const merged: Scene = { ...a, endSeconds: b.endSeconds, transitionOut: b.transitionOut };
  return [...scenes.slice(0, index), merged, ...scenes.slice(index + 2)];
}

export function replaceScene(scenes: Scene[], index: number, patch: Partial<Scene>): Scene[] {
  return scenes.map((s, i) => (i === index ? { ...s, ...patch } : s));
}
