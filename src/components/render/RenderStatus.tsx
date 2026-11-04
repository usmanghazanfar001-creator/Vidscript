"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type RenderView = {
  id: string; projectId: string; projectTitle: string; status: string; progress: number;
  outputUrl: string | null; errorMessage: string | null; startedAt: string | null; completedAt: string | null; storyboardVersion: number | null;
};

const ACTIVE = ["QUEUED", "RENDERING"];

export function RenderStatus({ initial }: { initial: RenderView }) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ACTIVE.includes(job.status)) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/renders/${job.id}`);
        if (!res.ok) return;
        const next = (await res.json()) as Omit<RenderView, "projectTitle">;
        setJob((j) => ({ ...j, ...next }));
      } catch { /* transient network error: keep polling */ }
    }, 1500);
    return () => clearInterval(t);
  }, [job.id, job.status]);

  async function act(action: "cancel" | "retry") {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/renders/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string; status?: string; progress?: number };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (action === "retry" && data.id) router.push(`/renders/${data.id}`);
      else setJob((j) => ({ ...j, status: data.status ?? j.status }));
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(false); }
  }

  const file = (name: string) => `/api/renders/${job.id}/file?name=${name}&download=1`;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href={`/projects/${job.projectId}`} className="text-sm text-white/60 hover:text-white">← {job.projectTitle}</Link>
      <h1 className="mt-4 text-2xl font-bold">Silent draft render</h1>
      <p className="mt-1 text-sm text-white/60">Draft visual base only: no voiceover, no captions. Align it to your real voiceover before publishing.</p>

      {ACTIVE.includes(job.status) ? (
        <div className="mt-8">
          <div className="flex justify-between text-sm"><span>{job.status === "QUEUED" ? "Waiting in the queue…" : "Rendering…"}</span><span>{job.progress}%</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy-900"><div className="h-full bg-brand-orange transition-all" style={{ width: `${job.progress}%` }} /></div>
          <button type="button" onClick={() => act("cancel")} disabled={busy} className="mt-6 rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40">Cancel render</button>
        </div>
      ) : null}

      {job.status === "COMPLETED" && job.outputUrl ? (
        <div className="mt-8 space-y-6">
          <video src={job.outputUrl} controls className="w-full rounded-xl border border-white/10 bg-black" />
          <div className="flex flex-wrap gap-3 text-sm">
            <a href={file("draft.mp4")} className="rounded-xl bg-brand-orange px-5 py-2 font-semibold text-navy-950">Download silent MP4</a>
            <a href={file("sceneTiming.json")} className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10">sceneTiming.json</a>
            <a href={file("storyboard.json")} className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10">Storyboard JSON</a>
            <a href={file("credits.txt")} className="rounded-xl border border-white/20 px-4 py-2 hover:bg-white/10">Stock credits</a>
          </div>
        </div>
      ) : null}

      {job.status === "FAILED" || job.status === "CANCELED" ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-navy-900 p-5">
          <p className={job.status === "FAILED" ? "font-semibold text-red-400" : "font-semibold text-white/70"}>{job.status === "FAILED" ? "Render failed" : "Render canceled"}</p>
          {job.errorMessage ? <p className="mt-2 break-words text-sm text-white/70">{job.errorMessage}</p> : null}
          <button type="button" onClick={() => act("retry")} disabled={busy} className="mt-4 rounded-xl bg-brand-orange px-5 py-2 font-semibold text-navy-950 disabled:opacity-40">Retry render</button>
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
    </main>
  );
}
