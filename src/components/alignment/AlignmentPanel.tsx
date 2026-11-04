"use client";
import { useState } from "react";
import type { Scene, VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import type { CaptionView } from "@/lib/captions/types";
import type { VoiceoverView } from "@/components/voiceover/VoiceoverPanel";
import { compareDurations } from "@/lib/audio/voiceover";
import { proportionalStretch } from "@/lib/timing/align";

type Suggestion = { storyboardVersion: number; rationale: string; scenes: Array<{ id: string; startSeconds: number; endSeconds: number }> };

const t = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

export function AlignmentPanel({ projectId, plan, version, dirty, voiceover, captions, onApply }: {
  projectId: string; plan: VidscriptPlan | null; version: number | null; dirty: boolean;
  voiceover: VoiceoverView | null; captions: CaptionView | null; onApply: (scenes: Scene[], label: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const planEnd = plan?.scenes.at(-1)?.endSeconds ?? null;
  const cmp = plan && voiceover && planEnd ? compareDurations(planEnd, voiceover.durationSeconds) : null;
  const aiBlock = !captions ? "Upload your Lafzaly captions to use AI realignment." : captions.validation.status === "invalid" ? "Fix the caption file problems first." : dirty ? "Save your changes first; the AI works from your saved storyboard." : version == null ? "Save a storyboard first." : null;

  async function runAi() {
    setBusy(true); setError(null); setSuggestion(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/alignment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method: "ai", storyboardVersion: version }) });
      const data = (await res.json().catch(() => ({}))) as Partial<Suggestion> & { error?: string };
      if (!res.ok || !data.scenes) throw new Error(data.error ?? `Request failed (${res.status})`);
      setSuggestion({ storyboardVersion: data.storyboardVersion!, rationale: data.rationale ?? "", scenes: data.scenes });
    } catch (e) { setError(e instanceof Error ? e.message : "Realignment failed"); } finally { setBusy(false); }
  }

  function approve() {
    if (!plan || !suggestion) return;
    if (suggestion.storyboardVersion !== version || dirty) return setError("The storyboard changed since this suggestion was made. Run the realignment again.");
    const byId = new Map(suggestion.scenes.map((s) => [s.id, s]));
    if (plan.scenes.some((s) => !byId.has(s.id))) return setError("The suggestion no longer matches your scenes. Run the realignment again.");
    onApply(plan.scenes.map((s) => ({ ...s, startSeconds: byId.get(s.id)!.startSeconds, endSeconds: byId.get(s.id)!.endSeconds })), "AI realignment");
    setSuggestion(null);
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-navy-900 p-5">
      <h2 className="text-lg font-semibold">Align scenes to the voiceover</h2>
      {!plan || !voiceover ? (
        <p className="mt-2 text-sm text-white/50">Generate a storyboard and upload your voiceover to align the scenes. The voiceover&apos;s real length becomes the master timeline.</p>
      ) : (
        <>
          <p className={`mt-2 text-sm ${cmp?.withinTolerance ? "text-emerald-400" : "text-brand-orange"}`}>
            {plan.mode === "final-render" && cmp?.withinTolerance
              ? `Timeline is aligned to the ${voiceover.durationSeconds.toFixed(1)}s voiceover.`
              : `Timeline is ${planEnd!.toFixed(1)}s; the voiceover is ${voiceover.durationSeconds.toFixed(1)}s (${cmp!.deltaSeconds >= 0 ? "+" : ""}${cmp!.percent.toFixed(1)}%).`}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Proportional stretch</h3>
              <p className="mt-1 text-sm text-white/60">Scales every scene by the same factor so the timeline ends exactly with the voiceover.</p>
              <button type="button" onClick={() => onApply(proportionalStretch(plan.scenes, voiceover.durationSeconds), "Proportional stretch")} className="mt-3 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold">Stretch to voiceover</button>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">Manual</h3>
              <p className="mt-1 text-sm text-white/60">Drag scene boundaries on the timeline. The waveform and caption cues show where each part is spoken; boundaries can snap to caption starts.</p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <h3 className="font-semibold">AI-assisted</h3>
              <p className="mt-1 text-sm text-white/60">Groq suggests where each scene should start using your script and captions. You review it before anything changes.</p>
              <button type="button" onClick={runAi} disabled={busy || aiBlock !== null} title={aiBlock ?? undefined} className="mt-3 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold disabled:opacity-40">{busy ? "Thinking…" : "Suggest timeline"}</button>
              {aiBlock ? <p className="mt-2 text-xs text-white/40">{aiBlock}</p> : null}
            </div>
          </div>

          {suggestion ? (
            <div className="mt-5 rounded-xl border border-brand-orange/50 p-4">
              <h3 className="font-semibold">Suggested timeline: review before applying</h3>
              {suggestion.rationale ? <p className="mt-1 text-sm text-white/70">{suggestion.rationale}</p> : null}
              <ol className="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
                {plan.scenes.map((s, i) => {
                  const n = suggestion.scenes.find((x) => x.id === s.id);
                  return (
                    <li key={s.id} className="flex justify-between gap-4">
                      <span className="truncate">{i + 1}. {s.title}</span>
                      <span className="shrink-0 text-white/60">{t(s.startSeconds)}–{t(s.endSeconds)} → <span className="text-white">{n ? `${t(n.startSeconds)}–${t(n.endSeconds)}` : "?"}</span></span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 flex gap-3">
                <button type="button" onClick={approve} className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-navy-950">Apply to timeline</button>
                <button type="button" onClick={() => setSuggestion(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Discard</button>
              </div>
              <p className="mt-2 text-xs text-white/40">Applying changes the editor only. Nothing is saved or rendered until you save a version.</p>
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
