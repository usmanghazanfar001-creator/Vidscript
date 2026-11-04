"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { vidscriptPlanSchema, type Scene, type VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import { defaultBrand } from "@/remotion/themes/defaultTheme";
import { moveBoundary } from "@/lib/timing/align";
import { mergeWithNext, replaceScene, splitScene } from "@/lib/timing/edit";
import { formatDuration } from "@/lib/timing/duration";
import { SceneTimeline } from "@/components/timeline/SceneTimeline";
import { PlanPreview } from "@/components/project/PlanPreview";
import { SceneEditor } from "./SceneEditor";
import { RenderHistory, type RenderSummary } from "@/components/render/RenderHistory";
import { VoiceoverPanel, type VoiceoverView } from "@/components/voiceover/VoiceoverPanel";
import { CaptionsPanel } from "@/components/captions/CaptionsPanel";
import { AlignmentPanel } from "@/components/alignment/AlignmentPanel";
import { snapToCues, toFinalRenderPlan } from "@/lib/timing/finalPlan";
import { loadPeaks } from "@/lib/audio/peaks";
import type { CaptionView } from "@/lib/captions/types";

type Props = {
  projectId: string;
  title: string;
  initial: { version: number; plan: VidscriptPlan } | null;
  generate: { script: string; visualStyle: string; wordsPerMinute: number };
  renders: RenderSummary[];
  voiceover: VoiceoverView | null;
  captions: CaptionView | null;
};

async function api<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export function StoryboardEditor({ projectId, title, initial, generate, renders, voiceover, captions }: Props) {
  const router = useRouter();
  const [liveVoiceover, setLiveVoiceover] = useState(voiceover);
  const [liveCaptions, setLiveCaptions] = useState(captions);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [peaksNote, setPeaksNote] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [plan, setPlan] = useState<VidscriptPlan | null>(initial?.plan ?? null);
  const [version, setVersion] = useState<number | null>(initial?.version ?? null);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "generate" | "render" | "assets" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const issues = useMemo(() => {
    if (!plan) return [];
    const r = vidscriptPlanSchema.safeParse(plan);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "plan"}: ${i.message}`);
  }, [plan]);

  function edit(scenes: Scene[]) {
    setPlan((p) => (p ? { ...p, scenes } : p));
    setDirty(true);
    setMessage(null);
  }
  function attempt(fn: () => Scene[]) {
    try { edit(fn()); } catch (e) { setMessage({ kind: "error", text: e instanceof Error ? e.message : "Edit failed" }); }
  }

  /** Finds a real photo/clip for every scene that has a search phrase and a Photo or Video setting but no visual yet. */
  async function findVisuals() {
    if (!plan) return;
    const targets = plan.scenes.filter((s) => s.assetPreference !== "none" && s.assetQuery && !s.assetId);
    if (targets.length === 0) {
      setMessage({ kind: "ok", text: "No scenes are waiting for a visual. A scene needs a search phrase and a Photo or Video setting; you can set them in the scene editor." });
      return;
    }
    setBusy("assets");
    let found = 0;
    const notes: string[] = [];
    for (const [n, s] of targets.entries()) {
      setMessage({ kind: "ok", text: `Finding visuals… ${n + 1} of ${targets.length}` });
      try {
        const r = await api<{ found: boolean; fields?: Partial<Scene>; message?: string }>("/api/assets/auto", {
          method: "POST", body: JSON.stringify({ query: s.assetQuery, kind: s.assetPreference }),
        });
        if (r.found && r.fields) {
          found++;
          setPlan((p) => (p ? { ...p, scenes: p.scenes.map((sc) => (sc.id === s.id ? { ...sc, ...r.fields } : sc)) } : p));
        } else notes.push(`"${s.title}": ${r.message ?? "nothing found"}`);
      } catch (e) {
        notes.push(`"${s.title}": ${e instanceof Error ? e.message : "failed"}`);
      }
    }
    if (found > 0) setDirty(true);
    setBusy(null);
    setMessage({
      kind: found > 0 ? "ok" : "error",
      text: `${found} of ${targets.length} visuals found.${notes.length ? ` ${notes.slice(0, 2).join(" ")}${notes.length > 2 ? ` (+${notes.length - 2} more)` : ""}` : ""}${found > 0 ? " Review them, then save a version." : ""}`,
    });
  }

  // Waveform of the real voiceover, decoded in the browser for the timeline.
  useEffect(() => {
    if (!liveVoiceover) { setPeaks(null); setPeaksNote(null); return; }
    let cancelled = false;
    setPeaksNote("Loading waveform…");
    loadPeaks(`${liveVoiceover.url}?v=${encodeURIComponent(liveVoiceover.uploadedAt)}`)
      .then((p) => { if (!cancelled) { setPeaks(p); setPeaksNote(null); } })
      .catch((e) => { if (!cancelled) { setPeaks(null); setPeaksNote(e instanceof Error ? e.message : "Waveform unavailable"); } });
    return () => { cancelled = true; };
  }, [liveVoiceover?.url, liveVoiceover?.uploadedAt]);

  const cueStarts = useMemo(() => liveCaptions?.cues.map((c) => c.startMs / 1000) ?? [], [liveCaptions]);

  /** Alignment replaces the timeline, so it asks first whenever that would discard edits or a previous alignment. */
  function applyAlignment(scenes: Scene[], label: string) {
    if (!plan || !liveVoiceover) return;
    const overwrites = dirty || plan.mode === "final-render";
    if (overwrites && !window.confirm(`${label} will replace your current timeline${dirty ? ", including unsaved edits" : ""}. Continue?`)) return;
    setPlan(toFinalRenderPlan(plan, {
      scenes, durationSeconds: liveVoiceover.durationSeconds,
      voiceoverUrl: `/api/projects/${projectId}/voiceover/file`,
      captionsUrl: liveCaptions ? `/api/projects/${projectId}/captions/file` : null,
    }));
    setDirty(true);
    setMessage({ kind: "ok", text: `${label} applied. Review the timeline, then save a version.` });
  }

  async function runGenerate() {
    if (dirty && !window.confirm("You have unsaved edits. Regenerating creates a new storyboard and replaces what you see. Continue?")) return;
    if (plan && !dirty && !window.confirm("Generate a new storyboard? Your saved versions are kept.")) return;
    setBusy("generate");
    setMessage(null);
    try {
      const res = await api<{ version: number; plan: VidscriptPlan }>(`/api/projects/${projectId}/visual-plan`, {
        method: "POST",
        body: JSON.stringify({ ...generate, brand: defaultBrand }),
      });
      setPlan(res.plan); setVersion(res.version); setSelected(0); setDirty(false);
      setMessage({ kind: "ok", text: `Storyboard v${res.version} generated.` });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Generation failed" });
    } finally { setBusy(null); }
  }

  async function save() {
    if (!plan) return;
    setBusy("save");
    setMessage(null);
    try {
      const res = await api<{ version: number }>(`/api/projects/${projectId}/storyboard`, { method: "PUT", body: JSON.stringify({ plan }) });
      setVersion(res.version); setDirty(false);
      setMessage({ kind: "ok", text: `Saved as version ${res.version}.` });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Save failed" });
    } finally { setBusy(null); }
  }

  async function startRender() {
    setBusy("render");
    setMessage(null);
    try {
      const res = await api<{ id: string }>(`/api/projects/${projectId}/render`, { method: "POST", body: JSON.stringify({ storyboardVersion: version }) });
      router.push(`/renders/${res.id}`);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Could not start the render" });
      setBusy(null);
    }
  }

  const scene = plan?.scenes[selected];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-white/60">
            {plan?.mode === "silent-draft" ? "Silent draft storyboard" : plan ? "Aligned to voiceover" : "Storyboard"}
            {version ? ` · v${version}` : ""}{dirty ? " · unsaved changes" : ""}
            {plan ? ` · ${formatDuration(plan.scenes.at(-1)!.endSeconds)} · ${plan.scenes.length} scenes` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={runGenerate} disabled={busy !== null} className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10 disabled:opacity-40">
            {busy === "generate" ? "Generating…" : plan ? "Regenerate with Groq" : "Generate storyboard"}
          </button>
          <button type="button" onClick={findVisuals} disabled={!plan || busy !== null} className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10 disabled:opacity-40">
            {busy === "assets" ? "Finding…" : "Find visuals"}
          </button>
          <button type="button" onClick={save} disabled={!plan || !dirty || issues.length > 0 || busy !== null} className="rounded-xl bg-brand-orange px-5 py-2 font-semibold text-navy-950 disabled:opacity-40">
            {busy === "save" ? "Saving…" : "Save version"}
          </button>
          <button
            type="button"
            onClick={startRender}
            disabled={!plan || plan.mode === "final-render" || dirty || issues.length > 0 || busy !== null}
            title={plan?.mode === "final-render" ? "Final render with voiceover is the next build step" : dirty ? "Save your changes first" : "Render a silent MP4 draft"}
            className="rounded-xl bg-brand-blue px-5 py-2 font-semibold text-white disabled:opacity-40"
          >
            {busy === "render" ? "Starting…" : "Render silent draft"}
          </button>
        </div>
      </div>

      {message ? <p className={`mt-4 text-sm ${message.kind === "error" ? "text-red-400" : "text-emerald-400"}`}>{message.text}</p> : null}

      {!plan ? (
        <p className="mt-10 text-white/60">No storyboard yet. Generate one from your script, then edit it here.</p>
      ) : (
        <>
          {issues.length > 0 ? (
            <ul className="mt-4 list-disc rounded-lg border border-red-400/40 bg-red-950/30 p-3 pl-8 text-sm text-red-300">
              {issues.slice(0, 5).map((i) => <li key={i}>{i}</li>)}
            </ul>
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-[3fr_2fr]">
            <div className="space-y-6">
              <PlanPreview plan={plan} />
              <SceneTimeline
                scenes={plan.scenes}
                selected={selected}
                onSelect={setSelected}
                onMoveBoundary={(i, secs) => attempt(() => moveBoundary(plan.scenes, i, snap && cueStarts.length ? snapToCues(secs, cueStarts) : secs))}
                domainSeconds={Math.max(plan.scenes.at(-1)!.endSeconds, liveVoiceover?.durationSeconds ?? 0)}
                peaks={peaks}
                voiceoverSeconds={liveVoiceover?.durationSeconds ?? null}
                cues={liveCaptions?.cues}
              />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-white/50">
                {liveCaptions ? <label className="flex items-center gap-2"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap boundaries to caption starts</label> : null}
                {peaks || liveCaptions ? <span>Blue: voiceover waveform · Orange: Lafzaly captions</span> : null}
                {peaksNote ? <span>{peaksNote}</span> : null}
              </div>
            </div>
            {scene ? (
              <SceneEditor
                scene={scene}
                index={selected}
                isLast={selected === plan.scenes.length - 1}
                onChange={(patch) => edit(replaceScene(plan.scenes, selected, patch))}
                onSplit={() => attempt(() => splitScene(plan.scenes, selected))}
                onMerge={() => attempt(() => mergeWithNext(plan.scenes, selected))}
              />
            ) : null}
          </div>
        </>
      )}
      <VoiceoverPanel projectId={projectId} initial={voiceover} onChange={setLiveVoiceover} storyboardSeconds={plan?.scenes.at(-1)?.endSeconds ?? null} />
      <CaptionsPanel projectId={projectId} initial={captions} plan={plan} voiceover={liveVoiceover} onChange={setLiveCaptions} />
      <AlignmentPanel projectId={projectId} plan={plan} version={version} dirty={dirty} voiceover={liveVoiceover} captions={liveCaptions} onApply={applyAlignment} />
      <RenderHistory renders={renders} />
    </main>
  );
}
