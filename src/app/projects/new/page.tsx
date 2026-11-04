"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countWords, estimateSeconds, formatDuration, WPM_DEFAULT, WPM_MAX, WPM_MIN } from "@/lib/timing/duration";
import { defaultBrand } from "@/remotion/themes/defaultTheme";

const styles = ["Map explainer", "Educational slides", "Data visualization", "Documentary", "Geopolitical history", "Technology explainer"];
const field = "mt-2 w-full rounded-xl border border-white/10 bg-navy-900 p-3";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function NewProject() {
  const router = useRouter();
  const [mode, setMode] = useState<"silent-draft" | "final-render">("silent-draft");
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [wpm, setWpm] = useState(WPM_DEFAULT);
  const [visualStyle, setVisualStyle] = useState(styles[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const words = useMemo(() => countWords(script), [script]);
  const seconds = useMemo(() => estimateSeconds(words, wpm), [words, wpm]);
  const canSubmit = mode === "silent-draft" && title.trim().length > 0 && script.trim().length >= 20 && !busy;

  async function submit() {
    setBusy(true); setError(null);
    let id = createdId;
    try {
      if (!id) {
        id = (await post<{ id: string }>("/api/projects", { title, mode, visualStyle, script, wordsPerMinute: wpm })).id;
        setCreatedId(id);
      }
      await post(`/api/projects/${id}/visual-plan`, { script, visualStyle, wordsPerMinute: wpm, brand: defaultBrand });
      router.push(`/projects/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">New project</h1>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {(["silent-draft", "final-render"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-xl border p-4 text-left ${mode === m ? "border-brand-orange bg-navy-900" : "border-white/10"}`}>
            {m === "silent-draft" ? "Script-only silent draft" : "Voiceover final render"}
          </button>
        ))}
      </div>
      {mode === "final-render" ? (
        <p className="mt-4 text-sm text-white/60">Final render needs voiceover and caption uploads, which come in a later build step. Create a silent draft first; you can add the voiceover to the same project later.</p>
      ) : null}

      <label className="mt-8 block text-sm text-white/70">Project title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />

      <label className="mt-6 block text-sm text-white/70">Script (plain text or Markdown)</label>
      <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={10} className={field} />
      <p className="mt-2 text-sm text-white/60">{words} words · about {formatDuration(seconds)} at {wpm} WPM</p>

      <label className="mt-6 block text-sm text-white/70">Narration pace: {wpm} WPM</label>
      <input type="range" min={WPM_MIN} max={WPM_MAX} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} className="w-full" />

      <label className="mt-6 block text-sm text-white/70">Visual style</label>
      <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className={field}>{styles.map((s) => <option key={s}>{s}</option>)}</select>

      {error ? (
        <p className="mt-6 text-sm text-red-400">
          {error}{createdId ? " Your project was created; press the button to retry the storyboard." : ""}
        </p>
      ) : null}
      <button type="button" onClick={submit} disabled={!canSubmit} className="mt-8 rounded-xl bg-brand-orange px-6 py-3 font-semibold text-navy-950 disabled:opacity-40">
        {busy ? "Generating storyboard…" : createdId ? "Retry storyboard" : "Create and generate storyboard"}
      </button>
    </main>
  );
}
