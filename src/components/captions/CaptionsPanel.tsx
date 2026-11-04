"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { VidscriptVideo } from "@/remotion/compositions/VidscriptVideo";
import type { VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import { CAPTION_PRESETS, PRESET_LABELS, captionStyleForPreset, type CaptionPreset } from "@/lib/captions/presets";
import type { CaptionView } from "@/lib/captions/types";
import type { VoiceoverView } from "@/components/voiceover/VoiceoverPanel";
import { formatDuration } from "@/lib/timing/duration";

const MAX_BYTES = 5 * 1024 * 1024;
const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (ms: number) => `${Math.floor(ms / 60000)}:${pad(Math.floor(ms / 1000) % 60)}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;

export function CaptionsPanel({ projectId, initial, plan, voiceover, onChange }: { projectId: string; initial: CaptionView | null; plan: VidscriptPlan | null; voiceover: VoiceoverView | null; onChange?: (c: CaptionView | null) => void }) {
  const [captions, setCaptions] = useState(initial);
  const apply = (c: CaptionView | null) => { setCaptions(c); onChange?.(c); };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  // The voiceover changed: re-check the caption timing against the new audio length.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    fetch(`/api/projects/${projectId}/captions`).then((r) => r.json()).then((d: { captions?: CaptionView | null }) => d.captions !== undefined && apply(d.captions)).catch(() => {});
  }, [projectId, voiceover?.durationSeconds, voiceover?.uploadedAt]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!/\.(srt|vtt)$/i.test(file.name)) return setError("Use a Lafzaly .srt (preferred) or .vtt export.");
    if (file.size > MAX_BYTES) return setError("Caption file is too large (limit 5 MB).");
    if (captions && !window.confirm("Replace the current caption file with this new Lafzaly export?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/captions?${new URLSearchParams({ name: file.name })}`, { method: "POST", body: file });
      const data = (await res.json().catch(() => ({}))) as { captions?: CaptionView; error?: string };
      if (!res.ok || !data.captions) throw new Error(data.error ?? `Upload failed (${res.status})`);
      apply(data.captions);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function patch(change: { preset?: CaptionPreset; enabled?: boolean }) {
    if (!captions) return;
    const before = captions;
    apply({ ...captions, ...change });
    const res = await fetch(`/api/projects/${projectId}/captions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    if (!res.ok) { apply(before); setError("Could not save the caption style. Please retry."); }
  }

  async function remove() {
    if (!window.confirm("Remove the caption file? The video will render without captions.")) return;
    const res = await fetch(`/api/projects/${projectId}/captions`, { method: "DELETE" });
    if (res.ok) apply(null); else setError("Could not remove the captions. Please retry.");
  }

  // Preview = your storyboard + the real voiceover + the Lafzaly cues, exactly as the final render will compose them.
  const preview = useMemo(() => {
    if (!plan || !captions || captions.validation.errors.length > 0 && captions.cues.length === 0) return null;
    const lastCue = captions.cues[captions.cues.length - 1]?.endMs ?? 0;
    const seconds = Math.max(plan.scenes.at(-1)?.endSeconds ?? 1, lastCue / 1000, voiceover?.durationSeconds ?? 0);
    const p: VidscriptPlan = {
      ...plan, mode: "final-render", voiceoverUrl: voiceover ? `${voiceover.url}?v=${encodeURIComponent(voiceover.uploadedAt)}` : null,
      actualDurationSeconds: voiceover?.durationSeconds ?? seconds, captionStyle: captionStyleForPreset(captions.preset, captions.enabled),
    };
    return { plan: p, frames: Math.max(1, Math.ceil(seconds * plan.fps)) };
  }, [plan, captions, voiceover]);

  const v = captions?.validation;
  const badge = v?.status === "valid" ? ["Timing valid", "text-emerald-400"] : v?.status === "invalid" ? ["Needs attention", "text-red-400"] : ["Not yet checked against a voiceover", "text-white/60"];

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-navy-900 p-5">
      <h2 className="text-lg font-semibold">Lafzaly captions</h2>
      <p className="mt-1 text-sm text-white/60">Upload the caption file you exported from Lafzaly. Vidscript shows it exactly as exported: text and timing are never changed.</p>

      {captions ? (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-4">
            <div><dt className="text-white/50">File</dt><dd className="truncate font-semibold" title={captions.fileName}>{captions.fileName}</dd></div>
            <div><dt className="text-white/50">Captions</dt><dd className="font-semibold">{captions.cueCount} cues ({captions.format.toUpperCase()})</dd></div>
            <div><dt className="text-white/50">Language</dt><dd className="font-semibold">{captions.declaredLanguage ?? (captions.script ? `${captions.script} script (detected)` : "Unknown")}</dd></div>
            <div><dt className="text-white/50">Coverage</dt><dd className="font-semibold">
              {voiceover ? `${formatDuration(captions.coverageSeconds)} of ${formatDuration(voiceover.durationSeconds)} (${Math.round((captions.coverageSeconds / voiceover.durationSeconds) * 100)}%)` : `ends at ${formatDuration(captions.coverageSeconds)}`}
            </dd></div>
          </dl>

          <div>
            <p className={`text-sm font-semibold ${badge[1]}`}>{badge[0]}</p>
            {v && v.errors.length > 0 ? <ul className="mt-2 list-disc pl-6 text-sm text-red-300">{v.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}{v.errors.length > 8 ? <li>…and {v.errors.length - 8} more</li> : null}</ul> : null}
            {v && v.warnings.length > 0 ? <ul className="mt-2 list-disc pl-6 text-sm text-brand-orange">{v.warnings.slice(0, 5).map((e) => <li key={e}>{e}</li>)}{v.warnings.length > 5 ? <li>…and {v.warnings.length - 5} more warnings</li> : null}</ul> : null}
            {v?.status === "unchecked" ? <p className="mt-1 text-sm text-white/50">Upload your voiceover to check that every caption falls inside it.</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CAPTION_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => patch({ preset: p })} className={`rounded-lg border px-3 py-1 text-sm ${captions.preset === p ? "border-brand-orange bg-brand-orange/10" : "border-white/20 hover:bg-white/10"}`}>{PRESET_LABELS[p]}</button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={captions.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> Burn captions into the video</label>
          </div>

          {preview ? (
            <div>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <Player component={VidscriptVideo} inputProps={{ plan: preview.plan, captions: captions.cues, assetBaseUrl: "" }} durationInFrames={preview.frames}
                  compositionWidth={preview.plan.width} compositionHeight={preview.plan.height} fps={preview.plan.fps} controls style={{ width: "100%" }} />
              </div>
              <p className="mt-2 text-xs text-white/40">Preview uses your current storyboard; scene timing is aligned to the voiceover in a later step.</p>
            </div>
          ) : <p className="text-sm text-white/50">Generate a storyboard to preview the captions over video.</p>}

          <details className="text-sm">
            <summary className="cursor-pointer text-white/70">Show cues</summary>
            <ol className="mt-2 max-h-64 space-y-1 overflow-auto rounded-lg bg-navy-950 p-3">
              {captions.cues.slice(0, 100).map((c, i) => (
                <li key={i} className="flex gap-3"><span className="shrink-0 text-white/40">{stamp(c.startMs)}</span><span dir="auto" className="whitespace-pre-line">{c.text}</span></li>
              ))}
              {captions.cues.length > 100 ? <li className="text-white/40">…{captions.cues.length - 100} more</li> : null}
            </ol>
          </details>
        </div>
      ) : <p className="mt-4 text-sm text-white/50">No caption file yet. Without one, the final video renders without captions.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept=".srt,.vtt" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold disabled:opacity-40">{busy ? "Uploading…" : captions ? "Replace caption file" : "Upload caption file"}</button>
        {captions ? <>
          <a href={`${captions.url}?download=1`} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Download original</a>
          <button type="button" onClick={remove} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Remove</button>
        </> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
